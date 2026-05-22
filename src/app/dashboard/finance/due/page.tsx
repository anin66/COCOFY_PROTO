"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { db, auth, storage } from "@/lib/firebase";
import { collection, onSnapshot, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { 
  CheckCircle, MapPin, Phone, Calendar, TreePine, 
  IndianRupee, UploadCloud, X, History, AlertCircle
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { compressImage, withTimeout } from "@/lib/imageCompression";

export default function FinanceDueAmount() {
  const { showToast } = useToast();
  const router = useRouter();
  const [currentUserRole, setCurrentUserRole] = useState<string>("finance");
  const [currentUserName, setCurrentUserName] = useState<string>("Finance Manager");
  const [loading, setLoading] = useState(true);
  const [duePayments, setDuePayments] = useState<any[]>([]);

  // Payment Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [paymentTab, setPaymentTab] = useState<"PAY_REMAINING" | "PAY_PARTIAL">("PAY_REMAINING");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "GPAY">("CASH");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [receiverName, setReceiverName] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role || "";
        if (!role.toUpperCase().includes("FINANCE")) {
          router.replace(`/dashboard/${role.toLowerCase()}`);
        } else {
          setCurrentUserRole(role);
          setCurrentUserName(userDoc.data().name || "Finance Manager");
        }
      }
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    // Listen to payments collection for UNPAID or PARTIALLY_PAID
    const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.paymentStatus === "UNPAID" || data.paymentStatus === "PARTIALLY_PAID") {
          list.push({ ...data, id: d.id });
        }
      });
      list.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
      setDuePayments(list);
      setLoading(false);
    });
    return () => unsubPayments();
  }, []);

  const handleOpenPayment = (payment: any) => {
    setSelectedPayment(payment);
    setPaymentTab("PAY_REMAINING");
    setPaymentMethod("CASH");
    setReceivedAmount("");
    setReceiverName("");
    setUploadedFile(null);
    setUploadError(null);
    setPaymentModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // 20MB limit
      if (file.size > 20 * 1024 * 1024) {
        setUploadError("Screenshot exceeds the 20MB limit.");
        setUploadedFile(null);
      } else {
        setUploadedFile(file);
      }
    }
  };

  const handleSubmitPayment = async () => {
    if (!selectedPayment) return;
    
    if (paymentMethod === "CASH" && !receiverName.trim()) {
      showToast("Receiver name is mandatory for cash payments.", "warning");
      return;
    }

    if (paymentTab === "PAY_PARTIAL" && !receivedAmount) {
      showToast("Please enter the received amount.", "warning");
      return;
    }

    let paidAmount = 0;
    if (paymentTab === "PAY_REMAINING") {
      paidAmount = selectedPayment.dueAmount;
    } else {
      paidAmount = parseFloat(receivedAmount);
      if (isNaN(paidAmount) || paidAmount <= 0) {
        showToast("Enter a valid amount greater than 0", "warning");
        return;
      }
      if (paidAmount > selectedPayment.dueAmount) {
        showToast("Cannot pay more than the remaining due amount.", "error");
        return;
      }
    }

    setSubmitting(true);
    try {
      const newTotalPaid = selectedPayment.paidAmount + paidAmount;
      const newDueAmount = selectedPayment.totalAmount - newTotalPaid;
      
      let fileUrl = null;
      if (uploadedFile) {
        try {
          const compressedFile = await compressImage(uploadedFile);
          const fileRef = ref(storage, `payments/${selectedPayment.id}/${Date.now()}_${compressedFile.name}`);
          await withTimeout(
            uploadBytes(fileRef, compressedFile),
            10000,
            "Upload timed out."
          );
          fileUrl = await getDownloadURL(fileRef);
        } catch (uploadError) {
          console.error("Failed to upload optional receipt screenshot:", uploadError);
          showToast("Payment recorded without receipt (upload failed).", "warning");
        }
      }

      const transaction = {
        amount: paidAmount,
        method: paymentMethod,
        receiverName: paymentMethod === "CASH" ? receiverName : null,
        fileUrl: fileUrl,
        date: new Date().toISOString()
      };

      const paymentRef = doc(db, "payments", selectedPayment.id);
      
      const isFullyPaid = newDueAmount <= 0;

      await withTimeout(
        updateDoc(paymentRef, {
          paidAmount: newTotalPaid,
          dueAmount: newDueAmount,
          paymentStatus: isFullyPaid ? "FULLY_PAID" : "PARTIALLY_PAID",
          transactions: arrayUnion(transaction),
          lastUpdatedAt: new Date().toISOString()
        }),
        10000,
        "Database update timed out. Please check your connection."
      );

      setPaymentModalOpen(false);
      showToast("Payment recorded successfully.", "success");
      
      if (isFullyPaid) {
        router.push("/dashboard/finance/history");
      }
      
    } catch (error: any) {
      console.error("Error updating payment:", error);
      showToast(error.message || "Failed to update payment record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Due Amounts" />

        <div style={{ padding: "2.5rem", flex: 1, maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
            <div>
              <h2 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Pending Dues</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", margin: 0 }}>
                Jobs with partial or unpaid balances.
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }}></div>
            </div>
          ) : duePayments.length === 0 ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "300px",
              background: "rgba(13, 6, 40, 0.5)",
              backdropFilter: "blur(12px)",
              borderRadius: "12px",
              border: "1px dashed var(--surface-border)",
              color: "rgba(255,255,255,0.5)"
            }}>
              <p>No pending dues. All payments are clear.</p>
            </div>
          ) : (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
              gap: "1.5rem" 
            }}>
              {duePayments.map((payment) => {
                const job = payment.jobDetails;
                
                return (
                  <div key={payment.id} 
                    className="job-card"
                    style={{
                    padding: "1.5rem",
                    borderRadius: "16px",
                    display: "flex",
                    flexDirection: "column"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        background: payment.paymentStatus === "UNPAID" ? "rgba(239, 35, 60, 0.15)" : "rgba(245, 158, 11, 0.15)", 
                        padding: "0.3rem 0.6rem",
                        borderRadius: "100px", 
                        border: `1px solid ${payment.paymentStatus === "UNPAID" ? "var(--error)" : "var(--accent)"}`,
                        fontSize: "0.7rem", fontWeight: 600,
                        letterSpacing: "0.05em", color: payment.paymentStatus === "UNPAID" ? "var(--error)" : "var(--accent)",
                      }}>
                        {payment.paymentStatus === "UNPAID" ? <AlertCircle size={12} /> : <History size={12} />}
                        {payment.paymentStatus.replace("_", " ")}
                      </div>
                    </div>

                    <h4 style={{ fontSize: "1.5rem", margin: "0 0 1rem 0", fontWeight: 700 }}>{job.customerName}</h4>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Phone size={16} color="var(--accent)" className="icon-hover-effect" /> {job.phone}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={16} color="var(--accent)" className="icon-hover-effect" /> {job.location}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Calendar size={16} color="var(--accent)" className="icon-hover-effect" /> {job.date}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <TreePine size={16} color="var(--accent)" className="icon-hover-effect" /> Trees: {job.trees}
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div style={{ 
                      background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem",
                      border: "1px solid rgba(255,255,255,0.05)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>Total Job Cost:</span>
                        <span style={{ fontWeight: 500 }}>₹{payment.totalAmount.toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>Amount Paid:</span>
                        <span style={{ color: "#10b981", fontWeight: 600 }}>₹{payment.paidAmount.toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "0.5rem", marginTop: "0.25rem", fontSize: "1rem" }}>
                        <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>Due Amount:</span>
                        <span style={{ color: "var(--error)", fontWeight: 700 }}>₹{payment.dueAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleOpenPayment(payment)}
                      style={{
                        width: "100%", padding: "0.875rem",
                        background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                        color: "white", border: "none", borderRadius: "12px",
                        fontWeight: 600, cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                      }}
                    >
                      <IndianRupee size={18} />
                      Receive Payment
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Payment Modal */}
      {paymentModalOpen && selectedPayment && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem"
        }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => !submitting && setPaymentModalOpen(false)} />
          
          <div 
            className="mobile-scroll-modal"
            style={{
              position: "relative",
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%", maxWidth: "550px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              animation: "modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)" }}>
              <h3 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700 }}>Receive Payment</h3>
              <button 
                onClick={() => !submitting && setPaymentModalOpen(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                {[
                  { id: "PAY_REMAINING", label: "Pay Full Remaining" },
                  { id: "PAY_PARTIAL", label: "Pay Partial Amount" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPaymentTab(tab.id as any)}
                    style={{
                      flex: 1, padding: "0.75rem", borderRadius: "8px",
                      background: paymentTab === tab.id ? "rgba(123, 44, 191, 0.15)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${paymentTab === tab.id ? "var(--primary)" : "var(--surface-border)"}`,
                      color: paymentTab === tab.id ? "white" : "rgba(255,255,255,0.6)",
                      fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 550, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem" }}>
                  Amount Received
                </label>
                <input 
                  type="number"
                  value={paymentTab === "PAY_REMAINING" ? selectedPayment.dueAmount : receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  disabled={paymentTab === "PAY_REMAINING"}
                  placeholder="Enter amount"
                  style={{
                    width: "100%", padding: "0.875rem",
                    background: "rgba(0,0,0,0.2)", border: "1px solid var(--surface-border)",
                    borderRadius: "10px", color: "white", fontSize: "1rem", outline: "none"
                  }}
                />
                {paymentTab === "PAY_REMAINING" && (
                  <p style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "0.5rem" }}>
                    Auto-filled to remaining due amount (₹{selectedPayment.dueAmount.toLocaleString()})
                  </p>
                )}
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 550, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem" }}>
                  Payment Method
                </label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", color: "white" }}>
                    <input type="radio" name="method" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} />
                    Cash
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", color: "white" }}>
                    <input type="radio" name="method" checked={paymentMethod === "GPAY"} onChange={() => setPaymentMethod("GPAY")} />
                    GPay
                  </label>
                </div>
              </div>

              {paymentMethod === "CASH" && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 550, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem" }}>
                    Receiver Name (Required)
                  </label>
                  <input 
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Name of person receiving cash"
                    style={{
                      width: "100%", padding: "0.875rem",
                      background: "rgba(0,0,0,0.2)", border: "1px solid var(--surface-border)",
                      borderRadius: "10px", color: "white", fontSize: "1rem", outline: "none"
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 550, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem" }}>
                  {paymentMethod === "GPAY" ? "Screenshot Upload (Optional)" : "Receiver Photo (Optional)"}
                </label>
                
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  border: "1px dashed var(--primary)", borderRadius: "10px", padding: "1.5rem",
                  cursor: "pointer", background: "rgba(123, 44, 191, 0.05)",
                  transition: "all 0.2s"
                }}>
                  <UploadCloud size={24} color="var(--accent)" style={{ marginBottom: "0.5rem" }} />
                  <span style={{ fontSize: "0.85rem", color: "white", fontWeight: 550 }}>
                    {uploadedFile ? uploadedFile.name : "Click to select a file"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: "0.25rem" }}>
                    Max size: 20MB
                  </span>
                  <input type="file" onChange={handleFileChange} accept="image/*" style={{ display: "none" }} />
                </label>
                
                {uploadError && (
                  <p style={{ color: "var(--error)", fontSize: "0.8rem", marginTop: "0.5rem", fontWeight: 500 }}>
                    {uploadError}
                  </p>
                )}
              </div>

              <button 
                onClick={handleSubmitPayment}
                disabled={submitting}
                style={{
                  width: "100%", padding: "1rem",
                  background: submitting ? "var(--surface-border)" : "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                  color: "white", border: "none", borderRadius: "12px",
                  fontWeight: 600, fontSize: "1rem", cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem"
                }}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes modalIn {
          0% { transform: scale(0.9) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes modalOut {
          0% { transform: scale(1); opacity: 1; filter: blur(0px); }
          40% { transform: scale(1.03); opacity: 0.9; }
          100% { transform: scale(0.8) translateY(50px); opacity: 0; filter: blur(10px); }
        }
        @keyframes cardPopIn {
          0% { transform: scale(0.8) translateY(40px); opacity: 0; box-shadow: 0 0 0 rgba(0, 0, 0, 0); }
          50% { transform: scale(1.05) translateY(-5px); opacity: 1; box-shadow: 0 20px 40px rgba(123, 44, 191, 0.4); border-color: var(--primary); }
          75% { transform: scale(0.98) translateY(2px); }
          100% { transform: scale(1) translateY(0); box-shadow: 0 0 0 rgba(0, 0, 0, 0); border-color: var(--surface-border); }
        }
        @keyframes dropdownFadeIn {
          0% { transform: translateY(-5px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes cardDeleteOut {
          0% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0); }
          50% { transform: scale(1.05); border-color: #ef4444; box-shadow: 0 10px 20px rgba(239, 68, 68, 0.2); }
          100% { transform: scale(0.8) translateY(20px); opacity: 0; filter: blur(8px); max-height: 0; padding-top: 0; padding-bottom: 0; margin-top: 0; margin-bottom: 0; overflow: hidden; }
        }
        .modal-opening { animation: modalIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .modal-closing { animation: modalOut 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .new-card-anim { animation: cardPopIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; z-index: 10; }
        .delete-card-anim { animation: cardDeleteOut 0.25s cubic-bezier(0.175, 0.885, 0.32, 1) forwards; z-index: 10; }

        /* Premium Job Card Styling and Hover Micro-Animations */
        .job-card {
          background: var(--surface-2);
          border: 1px solid var(--surface-border);
          position: relative;
          overflow: hidden;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
                      box-shadow 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
                      border-color 0.3s ease, 
                      background 0.3s ease;
        }
        .job-card:hover {
          transform: translateY(-8px) scale(1.02);
          border-color: var(--accent);
          background: rgba(255, 255, 255, 0.03);
          box-shadow: 0 25px 45px -15px rgba(123, 44, 191, 0.4), 
                      0 0 30px -5px rgba(255, 0, 127, 0.15);
        }

        /* Vercel-like sweeps sheen glow on hover */
        .job-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: -150%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.08) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-25deg);
          transition: none;
          pointer-events: none;
        }
        .job-card:hover::after {
          left: 150%;
          transition: left 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Icons play scale & bounce effect */
        .icon-hover-effect {
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.3s ease;
        }
        .job-card:hover .icon-hover-effect {
          transform: scale(1.22) rotate(6deg);
          color: #ff007f !important;
        }
      `}} />
    </div>
  );
}
