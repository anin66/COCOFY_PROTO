"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { useToast } from "@/context/ToastContext";
import { db, auth } from "@/lib/firebase";
import { compressImage, fileToBase64, withTimeout } from "@/lib/imageCompression";
import { collection, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { 
  Clock, FileText, Users, CheckCircle, Truck, MapPin, 
  MoreVertical, Edit, Trash2, Phone, Calendar, TreePine, XCircle, IndianRupee, UploadCloud, X
} from "lucide-react";
import { SkeletonCard } from "@/components/ui/Skeleton";

interface AssignedWorker {
  uid: string;
  name: string;
  status: "pending" | "accepted" | "rejected";
  harvestedTrees?: number;
  harvestConfirmed?: boolean;
}

interface Job {
  id: string;
  customerName: string;
  phone: string;
  location: string;
  date: string;
  trees: number;
  workersRequired: number;
  pricePerTree: string;
  status: string;
  createdAt: string;
  time?: string;
  assignedWorkers?: AssignedWorker[];
}

export default function FinanceOverview() {
  const router = useRouter();
  const { showToast } = useToast();
  const [currentUserRole, setCurrentUserRole] = useState<string>("finance");
  const [currentUserName, setCurrentUserName] = useState<string>("Finance Manager");
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Payment Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [paymentTab, setPaymentTab] = useState<"FULLY_PAID" | "PARTIALLY_PAID" | "UNPAID">("FULLY_PAID");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "GPAY">("CASH");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [receiverName, setReceiverName] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        localStorage.removeItem("user_logged_in");
        localStorage.removeItem("user_role");
        router.replace("/login");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role || "finance";
        // Sync localStorage!
        localStorage.setItem("user_logged_in", "true");
        localStorage.setItem("user_role", role);
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
    let active = true;
    let jobsData: Job[] = [];
    let paymentsData: any[] = [];

    const updateCombined = () => {
      if (!active) return;
      const paymentIds = new Set(paymentsData.map(p => p.id));

      const jobsList: Job[] = [];
      jobsData.forEach((job) => {
        // Show only completed/archived jobs that haven't been processed by finance yet
        if ((job.status === "WORK_COMPLETED" || job.status === "ARCHIVED") && !paymentIds.has(job.id)) {
          jobsList.push(job);
        }
      });
      
      jobsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJobs(jobsList);
      setLoading(false);
    };

    // Listen to jobs and payments side-by-side to prevent memory leaks and ensure updates
    const unsubJobs = onSnapshot(collection(db, "jobs"), (jobsSnap) => {
      const list: Job[] = [];
      jobsSnap.forEach((d) => {
        list.push({ ...d.data() as Job, id: d.id });
      });
      jobsData = list;
      updateCombined();
    });

    const unsubPayments = onSnapshot(collection(db, "payments"), (paymentsSnap) => {
      const list: any[] = [];
      paymentsSnap.forEach((d) => {
        list.push({ ...d.data(), id: d.id });
      });
      paymentsData = list;
      updateCombined();
    });

    return () => {
      active = false;
      unsubJobs();
      unsubPayments();
    };
  }, []);

  const getJobHarvestTotal = (job: Job) => {
    return job.assignedWorkers
      ?.filter((w) => w.status === "accepted" && w.harvestConfirmed)
      ?.reduce((sum, w) => sum + (w.harvestedTrees || 0), 0) || 0;
  };

  const parsePrice = (priceStr: string) => {
    const num = parseInt(priceStr.replace(/[^0-9]/g, ""));
    return isNaN(num) ? 0 : num;
  };

  const calculateTotalCost = (job: Job) => {
    return getJobHarvestTotal(job) * parsePrice(job.pricePerTree);
  };

  const handleOpenPayment = (job: Job) => {
    setSelectedJob(job);
    setPaymentTab("FULLY_PAID");
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
    if (!selectedJob) return;
    
    if (paymentMethod === "CASH" && !receiverName.trim() && paymentTab !== "UNPAID") {
      showToast("Receiver name is mandatory for cash payments.", "error");
      return;
    }

    if (paymentTab === "PARTIALLY_PAID" && !receivedAmount) {
      showToast("Please enter the received amount.", "error");
      return;
    }

    const oldJobs = [...jobs];
    const targetJob = selectedJob;
    const targetTab = paymentTab;
    const targetReceivedAmount = receivedAmount;
    const targetPaymentMethod = paymentMethod;
    const targetReceiverName = receiverName;
    const targetUploadedFile = uploadedFile;

    // Do the upload and setDoc first
    setSubmitting(true);
    try {
      const totalCost = calculateTotalCost(targetJob);
      let paidAmount = 0;

      if (targetTab === "FULLY_PAID") {
        paidAmount = totalCost;
      } else if (targetTab === "PARTIALLY_PAID") {
        paidAmount = parseFloat(targetReceivedAmount);
        if (isNaN(paidAmount)) paidAmount = 0;
      }

      const dueAmount = totalCost - paidAmount;
      
      let fileUrl = null;
      if (targetUploadedFile) {
        try {
          const compressedFile = await compressImage(targetUploadedFile);
          fileUrl = await fileToBase64(compressedFile);
        } catch (uploadError) {
          console.error("Failed to process receipt screenshot:", uploadError);
          showToast("Failed to process receipt image. Please try another image.", "error");
          setSubmitting(false);
          return;
        }
      }

      const transaction = {
        amount: paidAmount,
        method: targetPaymentMethod,
        receiverName: targetPaymentMethod === "CASH" ? targetReceiverName : null,
        fileUrl: fileUrl,
        date: new Date().toISOString()
      };

      const paymentData = {
        jobId: targetJob.id,
        totalAmount: totalCost,
        paidAmount: paidAmount,
        dueAmount: dueAmount,
        paymentStatus: targetTab,
        jobDetails: targetJob,
        transactions: paidAmount > 0 ? [transaction] : [],
        lastUpdatedAt: new Date().toISOString()
      };

      await withTimeout(
        setDoc(doc(db, "payments", targetJob.id), paymentData),
        10000,
        "Database update timed out. Please check your connection."
      );

      // Optimistically remove the job from the current overview list
      setJobs((prev) => prev.filter((j) => j.id !== targetJob.id));

      // Close the modal
      setPaymentModalOpen(false);

      // Redirect to the correct section
      if (targetTab === "FULLY_PAID") {
        router.push("/dashboard/finance/history");
      } else {
        router.push("/dashboard/finance/due");
      }
    } catch (error: any) {
      console.error("Error saving payment:", error);
      showToast(error.message || "Failed to save payment record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Finance Overview" />

        <div style={{ padding: "2.5rem", flex: 1, maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
            <div>
              <h2 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Pending Payments</h2>
              <p style={{ color: "var(--text-muted)", margin: 0 }}>
                Jobs that have been completed and are awaiting payment collection.
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : jobs.length === 0 ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "300px",
              background: "rgba(13, 6, 40, 0.5)",
              backdropFilter: "blur(12px)",
              borderRadius: "12px",
              border: "1px dashed var(--surface-border)",
              color: "var(--text-dim)"
            }}>
              <p>No completed jobs awaiting payment.</p>
            </div>
          ) : (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
              gap: "1.5rem" 
            }}>
              {jobs.map((job) => {
                const totalCost = calculateTotalCost(job);

                return (
                  <div key={job.id} 
                    className="job-card"
                    style={{
                    padding: "1.5rem",
                    borderRadius: "16px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        background: "rgba(16,185,129,0.15)", padding: "0.3rem 0.6rem",
                        borderRadius: "100px", border: "1px solid rgba(16,185,129,0.5)",
                        fontSize: "0.7rem", fontWeight: 600,
                        letterSpacing: "0.05em", color: "#10b981",
                      }}>
                        <CheckCircle size={12} />
                        {job.status === "ARCHIVED" ? "ARCHIVED" : "WORK COMPLETED"}
                      </div>
                    </div>

                    <h4 style={{ fontSize: "1.5rem", margin: "0 0 1rem 0", fontWeight: 700 }}>{job.customerName}</h4>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Phone size={16} color="var(--accent)" className="icon-hover-effect" />
                        {job.phone}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={16} color="var(--accent)" className="icon-hover-effect" />
                        {job.location}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <TreePine size={16} color="var(--accent)" className="icon-hover-effect" />
                        Harvest: {getJobHarvestTotal(job)} trees
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <IndianRupee size={16} color="var(--accent)" className="icon-hover-effect" />
                        Cost: ₹{totalCost.toLocaleString()}
                      </div>
                    </div>

                    <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                        Harvest Reports
                      </div>
                      {job.assignedWorkers?.filter(w => w.status === "accepted").map((w, idx) => (
                        <div key={idx} style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "8px",
                          background: w.harvestConfirmed ? "rgba(16,185,129,0.08)" : "var(--surface-1)",
                          border: `1px solid ${w.harvestConfirmed ? "rgba(16,185,129,0.25)" : "var(--surface-border)"}`,
                        }}>
                          <span style={{ color: "var(--foreground)", fontWeight: 550 }}>{w.name}</span>
                          <span style={{
                            fontSize: "0.8rem", fontWeight: 600,
                            color: w.harvestConfirmed ? "#10b981" : "#f59e0b",
                          }}>
                            {w.harvestConfirmed ? `${w.harvestedTrees} trees` : "PENDING"}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => handleOpenPayment(job)}
                      style={{
                        width: "100%", padding: "0.875rem",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
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
      {paymentModalOpen && selectedJob && (
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
            <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-1)" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Record Customer Payment</h3>
              <button 
                onClick={() => setPaymentModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-light)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                {["FULLY_PAID", "PARTIALLY_PAID", "UNPAID"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPaymentTab(tab as any)}
                    style={{
                      flex: 1, padding: "0.75rem", borderRadius: "8px",
                      background: paymentTab === tab ? "var(--primary-glow)" : "var(--surface-2)",
                      border: `1px solid ${paymentTab === tab ? "var(--primary)" : "var(--surface-border)"}`,
                      color: paymentTab === tab ? "white" : "var(--text-muted)",
                      fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    {tab.replace("_", " ")}
                  </button>
                ))}
              </div>

              {paymentTab !== "UNPAID" && (
                <>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 550, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                      Amount Received
                    </label>
                    <input 
                      type="number"
                      value={paymentTab === "FULLY_PAID" ? calculateTotalCost(selectedJob) : receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      disabled={paymentTab === "FULLY_PAID"}
                      placeholder="Enter amount"
                      style={{
                        width: "100%", padding: "0.875rem",
                        background: "rgba(0,0,0,0.2)", border: "1px solid var(--surface-border)",
                        borderRadius: "10px", color: "white", fontSize: "1rem", outline: "none"
                      }}
                    />
                    {paymentTab === "FULLY_PAID" && (
                      <p style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "0.5rem" }}>
                        Auto-filled to total job cost (₹{calculateTotalCost(selectedJob).toLocaleString()})
                      </p>
                    )}
                  </div>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 550, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
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
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 550, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
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
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 550, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                      {paymentMethod === "GPAY" ? "Screenshot Upload (Optional)" : "Receiver Photo (Optional)"}
                    </label>
                    
                    <label style={{
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      border: "1px dashed var(--primary)", borderRadius: "10px", padding: "1.5rem",
                      cursor: "pointer", background: "var(--primary-glow)",
                      transition: "all 0.2s"
                    }}>
                      <UploadCloud size={24} color="var(--accent)" style={{ marginBottom: "0.5rem" }} />
                      <span style={{ fontSize: "0.85rem", color: "white", fontWeight: 550 }}>
                        {uploadedFile ? uploadedFile.name : "Click to select a file"}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
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
                </>
              )}
              
              {paymentTab === "UNPAID" && (
                <div style={{ padding: "1.5rem", background: "rgba(239, 35, 60, 0.05)", borderRadius: "10px", border: "1px dashed var(--error)", marginBottom: "1.5rem" }}>
                  <p style={{ margin: 0, color: "var(--error)", fontSize: "0.9rem", textAlign: "center", fontWeight: 500 }}>
                    This will move the job to the Due Amount section where you can collect payments later.
                  </p>
                </div>
              )}

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

        @media (max-width: 1150px) {
          .flex-stack-mobile {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1.25rem !important;
          }
        }
      `}} />
    </div>
  );
}
