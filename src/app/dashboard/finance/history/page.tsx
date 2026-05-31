"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, doc, getDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { 
  CheckCircle, MapPin, Phone, Calendar, TreePine, 
  IndianRupee, Download, Users, FileText, Image as ImageIcon, History as HistoryIcon,
  Trash2
} from "lucide-react";
import html2canvas from "html2canvas";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import jsPDF from "jspdf";

export default function FinanceHistory() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const router = useRouter();
  const [currentUserRole, setCurrentUserRole] = useState<string>("finance");
  const [currentUserName, setCurrentUserName] = useState<string>("Finance Manager");
  const [loading, setLoading] = useState(true);
  const [completedPayments, setCompletedPayments] = useState<any[]>([]);

  // Receipt Generation State
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const receiptRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleDeleteHistory = async (paymentId: string, customerName: string) => {
    const isConfirmed = await confirm({
      title: "Delete Payment Record?",
      message: `Are you sure you want to delete the payment history for "${customerName}"? This will permanently remove the record from the database.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });

    if (!isConfirmed) return;

    try {
      await deleteDoc(doc(db, "payments", paymentId));
      showToast("Payment record deleted successfully.", "success");
    } catch (error: any) {
      console.error("Error deleting payment record:", error);
      showToast(error.message || "Failed to delete payment record.", "error");
    }
  };

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
    // Listen to payments collection for FULLY_PAID
    const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.paymentStatus === "FULLY_PAID") {
          list.push({ ...data, id: d.id });
        }
      });
      list.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
      setCompletedPayments(list);
      setLoading(false);
    });
    return () => unsubPayments();
  }, []);

  const handleDownloadReceipt = async (paymentId: string, customerName: string) => {
    const element = receiptRefs.current[paymentId];
    if (!element) return;
    
    setGeneratingPdf(paymentId);
    try {
      // Temporarily make the receipt visible for html2canvas
      element.style.display = "block";
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff"
      });
      
      element.style.display = "none";

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt_${customerName.replace(/\s+/g, '_')}_${paymentId.slice(0, 6)}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      showToast("Failed to generate PDF receipt. Please check console for details.", "error");
    } finally {
      setGeneratingPdf(null);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Payment History" />

        <div style={{ padding: "2.5rem", flex: 1, maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
            <div>
              <h2 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Completed Payments</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", margin: 0 }}>
                Fully settled jobs and downloadable receipts.
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }}></div>
            </div>
          ) : completedPayments.length === 0 ? (
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
              <p>No completed payments found.</p>
            </div>
          ) : (
            <div style={{ 
              display: "flex", 
              flexDirection: "column",
              gap: "1.5rem" 
            }}>
              {completedPayments.map((payment) => {
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
                    {/* Header Row */}
                    <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: "0.4rem",
                          background: "rgba(16, 185, 129, 0.15)", 
                          padding: "0.3rem 0.6rem", width: "max-content",
                          borderRadius: "100px", border: "1px solid #10b981",
                          fontSize: "0.7rem", fontWeight: 700,
                          letterSpacing: "0.05em", color: "#10b981",
                        }}>
                          <CheckCircle size={12} />
                          FULLY PAID
                        </div>
                        <h4 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 700 }}>{job.customerName}</h4>
                      </div>
                      
                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                        <button 
                          onClick={() => handleDownloadReceipt(payment.id, job.customerName)}
                          disabled={generatingPdf === payment.id}
                          style={{
                            padding: "0.6rem 1.2rem",
                            background: generatingPdf === payment.id ? "var(--surface-border)" : "var(--surface-2)",
                            color: "white", border: "1px solid var(--primary)", borderRadius: "8px",
                            fontWeight: 600, cursor: generatingPdf === payment.id ? "not-allowed" : "pointer",
                            transition: "all 0.2s ease",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                            fontSize: "0.85rem",
                            width: "auto"
                          }}
                          onMouseEnter={(e) => {
                            if (generatingPdf !== payment.id) e.currentTarget.style.background = "var(--primary-glow)";
                          }}
                          onMouseLeave={(e) => {
                            if (generatingPdf !== payment.id) e.currentTarget.style.background = "var(--surface-2)";
                          }}
                        >
                          {generatingPdf === payment.id ? (
                            <>
                              <div className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
                              Generating PDF...
                            </>
                          ) : (
                            <>
                              <Download size={16} />
                              Download Receipt
                            </>
                          )}
                        </button>

                        <button 
                          onClick={() => handleDeleteHistory(payment.id, job.customerName)}
                          style={{
                            padding: "0.6rem 1.2rem",
                            background: "rgba(220, 38, 38, 0.12)",
                            color: "var(--error)", 
                            border: "1px solid rgba(220, 38, 38, 0.35)", 
                            borderRadius: "8px",
                            fontWeight: 600, 
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            gap: "0.5rem",
                            fontSize: "0.85rem"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(220, 38, 38, 0.25)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(220, 38, 38, 0.12)";
                          }}
                        >
                          <Trash2 size={16} />
                          Delete Record
                        </button>
                      </div>
                    </div>

                    <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Phone size={16} color="var(--accent)" className="icon-hover-effect" /> {job.phone}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={16} color="var(--accent)" className="icon-hover-effect" /> {job.location}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Calendar size={16} color="var(--accent)" className="icon-hover-effect" /> {job.date}
                      </div>
                    </div>

                    <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
                      {/* Left Col: Work Details */}
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <TreePine size={16} /> Work Summary
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "1rem", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                            <span style={{ color: "rgba(255,255,255,0.5)" }}>Trees Requested:</span>
                            <span style={{ fontWeight: 500 }}>{job.trees}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                            <span style={{ color: "rgba(255,255,255,0.5)" }}>Price Per Tree:</span>
                            <span style={{ fontWeight: 500 }}>{job.pricePerTree}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                            <span style={{ color: "rgba(255,255,255,0.5)" }}>Harvested Trees:</span>
                            <span style={{ color: "#10b981", fontWeight: 600 }}>{payment.totalAmount / parseInt(job.pricePerTree.replace(/[^0-9]/g, ""))}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "0.5rem", marginTop: "0.25rem", fontSize: "1rem" }}>
                            <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>Total Paid:</span>
                            <span style={{ color: "#10b981", fontWeight: 700 }}>₹{payment.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem", marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Users size={16} /> Team
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {job.assignedWorkers?.filter((w: any) => w.status === "accepted").map((w: any, idx: number) => (
                            <div key={idx} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "0.5rem 0.75rem", borderRadius: "8px",
                              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)"
                            }}>
                              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.82rem", fontWeight: 500 }}>{w.name}</span>
                              <span style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: 600 }}>{w.harvestedTrees} trees</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right Col: Transactions */}
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <HistoryIcon size={16} /> Transaction Breakdown
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          {payment.transactions?.map((tx: any, idx: number) => (
                            <div key={idx} style={{ 
                              background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "1rem", 
                              border: "1px solid rgba(255,255,255,0.05)" 
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <span style={{ 
                                    background: tx.method === "GPAY" ? "rgba(59, 130, 246, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                    color: tx.method === "GPAY" ? "#3b82f6" : "#10b981",
                                    padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700, border: `1px solid ${tx.method === "GPAY" ? "#3b82f6" : "#10b981"}`
                                  }}>
                                    {tx.method}
                                  </span>
                                  <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                                    {new Date(tx.date).toLocaleDateString()} at {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                                <span style={{ fontWeight: 700, color: "white" }}>₹{tx.amount.toLocaleString()}</span>
                              </div>
                              
                              {tx.method === "CASH" && tx.receiverName && (
                                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", marginBottom: tx.fileUrl ? "0.5rem" : 0 }}>
                                  Received by: <span style={{ fontWeight: 600, color: "white" }}>{tx.receiverName}</span>
                                </div>
                              )}
                              
                              {tx.fileUrl && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--accent)" }}>
                                  <ImageIcon size={14} />
                                  <a href={tx.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                                    View {tx.method === "GPAY" ? "Screenshot" : "Photo"}
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Hidden Receipt Element for PDF Generation */}
                    <div 
                      ref={el => { receiptRefs.current[payment.id] = el; }} 
                      style={{ 
                        display: "none", 
                        background: "white", 
                        color: "black", 
                        padding: "40px", 
                        width: "800px", 
                        fontFamily: "Arial, sans-serif" 
                      }}
                    >
                      <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "2px solid #eee", paddingBottom: "20px" }}>
                        <h1 style={{ color: "#1f481e", margin: "0 0 10px 0", fontSize: "28px" }}>COCOFY</h1>
                        <h2 style={{ margin: 0, color: "#333", fontSize: "18px" }}>OFFICIAL PAYMENT RECEIPT</h2>
                        <p style={{ margin: "5px 0 0 0", color: "#666", fontSize: "14px" }}>Date Generated: {new Date().toLocaleDateString()}</p>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
                        <div>
                          <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>Billed To:</p>
                          <h3 style={{ margin: "0 0 5px 0", fontSize: "18px", color: "#000" }}>{job.customerName}</h3>
                          <p style={{ margin: "0 0 5px 0", color: "#444", fontSize: "14px" }}>Phone: {job.phone}</p>
                          <p style={{ margin: "0 0 5px 0", color: "#444", fontSize: "14px" }}>Location: {job.location}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>Job ID: {job.id}</p>
                          <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>Work Date: {job.date}</p>
                          <p style={{ margin: "0 0 5px 0", color: "#10b981", fontSize: "16px", fontWeight: "bold" }}>STATUS: FULLY PAID</p>
                        </div>
                      </div>

                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
                        <thead>
                          <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #ddd" }}>
                            <th style={{ padding: "12px", textAlign: "left", color: "#333" }}>Description</th>
                            <th style={{ padding: "12px", textAlign: "center", color: "#333" }}>Qty</th>
                            <th style={{ padding: "12px", textAlign: "right", color: "#333" }}>Rate</th>
                            <th style={{ padding: "12px", textAlign: "right", color: "#333" }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: "1px solid #eee" }}>
                            <td style={{ padding: "12px", color: "#444" }}>Coconut Harvesting Service</td>
                            <td style={{ padding: "12px", textAlign: "center", color: "#444" }}>{payment.totalAmount / parseInt(job.pricePerTree.replace(/[^0-9]/g, ""))} trees</td>
                            <td style={{ padding: "12px", textAlign: "right", color: "#444" }}>{job.pricePerTree}</td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", color: "#000" }}>Rs. {payment.totalAmount.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>

                      <div style={{ marginBottom: "30px" }}>
                        <h4 style={{ margin: "0 0 10px 0", color: "#333", fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>Transaction History</h4>
                        {payment.transactions?.map((tx: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed #eee", fontSize: "14px", color: "#555" }}>
                            <span>{new Date(tx.date).toLocaleDateString()} - {tx.method} {tx.receiverName ? `(Recv: ${tx.receiverName})` : ''}</span>
                            <span style={{ fontWeight: "bold", color: "#000" }}>Rs. {tx.amount.toLocaleString()}</span>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: "18px", fontWeight: "bold", color: "#10b981" }}>
                          <span>Total Paid:</span>
                          <span>Rs. {payment.totalAmount.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Render images if any */}
                      {payment.transactions?.some((tx: any) => tx.fileUrl) && (
                        <div>
                          <h4 style={{ margin: "0 0 15px 0", color: "#333", fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>Attached Proofs</h4>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
                            {payment.transactions?.filter((tx: any) => tx.fileUrl).map((tx: any, idx: number) => (
                              <div key={idx} style={{ border: "1px solid #ddd", padding: "5px", background: "#f9f9f9" }}>
                                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666", textAlign: "center" }}>{tx.method} - {new Date(tx.date).toLocaleDateString()}</p>
                                {/* crossOrigin="anonymous" is critical for html2canvas to render Firebase Storage URLs without taint errors */}
                                <img src={tx.fileUrl} alt="Proof" crossOrigin="anonymous" style={{ maxWidth: "200px", maxHeight: "200px", objectFit: "contain" }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div style={{ marginTop: "40px", textAlign: "center", color: "#888", fontSize: "12px", borderTop: "1px solid #eee", paddingTop: "20px" }}>
                        <p>Thank you for doing business with Cocofy.</p>
                        <p>This is a computer generated receipt and does not require a physical signature.</p>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

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
          50% { transform: scale(1.05) translateY(-5px); opacity: 1; box-shadow: 0 20px 40px var(--primary-glow-border); border-color: var(--primary); }
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
          box-shadow: 0 25px 45px -15px var(--primary-glow-border), 
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
