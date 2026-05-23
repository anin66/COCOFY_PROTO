"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { 
  Search, Briefcase, Phone, MapPin, Calendar, 
  Users, TreePine, Clock, FileText, CheckCircle, Archive, Trash2
} from "lucide-react";

interface AssignedWorker {
  uid: string;
  name: string;
  status: "pending" | "accepted" | "rejected";
  harvestedTrees?: number;
  harvestConfirmed?: boolean;
}

interface AssignedDelivery {
  uid: string;
  name: string;
  status: "pending" | "confirmed";
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
  assignedDelivery?: AssignedDelivery | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [currentUserName, setCurrentUserName] = useState("Manager");
  const [currentUserRole, setCurrentUserRole] = useState("manager");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isAlertOnly?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const role = data.role || "manager";
          setCurrentUserName(data.name || "Manager");
          setCurrentUserRole(role);
          if (role !== "manager") {
            router.replace(`/dashboard/${role}`);
          }
        }
      } else {
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "jobs"), (snapshot) => {
      const archivedJobsList: Job[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status === "ARCHIVED") {
          archivedJobsList.push({ ...data, id: d.id } as Job);
        }
      });
      archivedJobsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setJobs(archivedJobsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching history jobs:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);



  const handleDeleteJob = (jobId: string, customerName: string) => {
    setConfirmConfig({
      title: "Delete Job Record",
      message: `Are you sure you want to permanently delete the job for "${customerName}" from the database? This action cannot be undone.`,
      confirmLabel: "Delete Job",
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          await deleteDoc(doc(db, "jobs", jobId));
        } catch (err) {
          console.error("Error deleting job:", err);
          setConfirmConfig({
            title: "Deletion Error",
            message: "Failed to delete job.",
            isAlertOnly: true,
            onConfirm: () => {}
          });
        }
      }
    });
  };

  const getJobHarvestTotal = (job: Job) => {
    return job.assignedWorkers
      ?.filter((w) => w.status === "accepted" && w.harvestConfirmed)
      ?.reduce((sum, w) => sum + (w.harvestedTrees || 0), 0) || 0;
  };

  const parsePrice = (priceStr: string) => {
    const num = parseInt(priceStr.replace(/[^0-9]/g, ""));
    return isNaN(num) ? 0 : num;
  };

  // Filter jobs based on search
  const filteredJobs = jobs.filter((job) =>
    job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics
  const totalJobs = jobs.length;
  const totalHarvestedTrees = jobs.reduce((sum, job) => sum + getJobHarvestTotal(job), 0);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Job History" />

        <div style={{ padding: "2rem", flex: 1 }}>
          {/* Stats Bar */}
          <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
            <div style={{
              background: "var(--surface)", border: "1px solid var(--surface-border)",
              borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem"
            }}>
              <div style={{
                width: "48px", height: "48px", background: "rgba(59,130,246,0.1)",
                borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6"
              }}>
                <Archive size={24} />
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                  Total Archived Jobs
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "white" }}>
                  {totalJobs}
                </div>
              </div>
            </div>

            <div style={{
              background: "var(--surface)", border: "1px solid var(--surface-border)",
              borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem"
            }}>
              <div style={{
                width: "48px", height: "48px", background: "rgba(16,185,129,0.1)",
                borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981"
              }}>
                <TreePine size={24} />
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                  Total Trees Harvested
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "white" }}>
                  {totalHarvestedTrees}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Archived Records</h3>
            <div className="flex-stack-mobile" style={{ display: "flex", gap: "1rem", width: "100%", maxWidth: "400px", justifyContent: "flex-end" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)" }} />
                <input
                  type="text"
                  placeholder="Search by customer or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: "var(--surface)", border: "1px solid var(--surface-border)",
                    color: "white", padding: "0.6rem 1rem 0.6rem 2.5rem",
                    borderRadius: "8px", width: "100%", outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }} />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "300px", background: "rgba(13,6,40,0.5)", backdropFilter: "blur(12px)",
              borderRadius: "16px", border: "1px dashed rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.4)", gap: "1rem",
            }}>
              <Archive size={48} strokeWidth={1.5} />
              <h4 style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.05em", margin: 0 }}>
                NO ARCHIVED JOBS FOUND
              </h4>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {filteredJobs.map((job) => {
                const jobHarvest = getJobHarvestTotal(job);
                const price = parsePrice(job.pricePerTree);
                const totalCost = jobHarvest * price;

                return (
                  <div
                    key={job.id}
                    className="job-card"
                    style={{ padding: "1.5rem", borderRadius: "16px" }}
                  >
                    {/* Status Badge */}
                    <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.3rem 0.6rem", borderRadius: "100px",
                        fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em",
                        background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981"
                      }}>
                        <CheckCircle size={12} />
                        ARCHIVED
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                          {job.date}
                        </span>
                        <button
                          onClick={() => handleDeleteJob(job.id, job.customerName)}
                          style={{
                            background: "rgba(239,35,60,0.08)",
                            color: "var(--error)",
                            border: "1px solid rgba(239,35,60,0.15)",
                            borderRadius: "6px",
                            width: "26px",
                            height: "26px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--error)";
                            e.currentTarget.style.color = "white";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(239,35,60,0.08)";
                            e.currentTarget.style.color = "var(--error)";
                          }}
                          title="Permanently Delete Job"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Customer Name */}
                    <h4 style={{ fontSize: "1.35rem", margin: "0 0 1rem 0", fontWeight: 700 }}>
                      {job.customerName}
                    </h4>

                    {/* Details Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "1.5rem", fontSize: "0.88rem", color: "rgba(255,255,255,0.8)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Phone size={16} color="#10b981" className="icon-hover-effect" />
                        <span style={{ color: "#10b981", fontWeight: 600 }}>{job.phone}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={16} color="var(--accent)" className="icon-hover-effect" />
                        {job.location}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <TreePine size={16} color="var(--accent)" className="icon-hover-effect" />
                        Harvested: <span style={{ color: "white", fontWeight: 600, marginLeft: "0.25rem" }}>{jobHarvest} / {job.trees}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Briefcase size={16} color="var(--accent)" className="icon-hover-effect" />
                        Rate: {job.pricePerTree}
                      </div>
                      {job.time && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Clock size={16} color="var(--accent)" className="icon-hover-effect" />
                          Time: {job.time}
                        </div>
                      )}
                      {totalCost > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", gridColumn: "span 2" }}>
                          <FileText size={16} color="#10b981" className="icon-hover-effect" />
                          <span>Total Payout: </span>
                          <span style={{ color: "#10b981", fontWeight: 700, marginLeft: "0.25rem" }}>
                            Rs. {totalCost}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Workers Breakdown */}
                    {job.assignedWorkers && job.assignedWorkers.some(w => w.status === "accepted") && (
                      <div style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--surface-border)",
                        padding: "0.85rem",
                        borderRadius: "12px",
                        marginBottom: "1.5rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem"
                      }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>
                          Worker Breakdown
                        </div>
                        {job.assignedWorkers.filter(w => w.status === "accepted").map((w, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>{w.name}</span>
                            <span style={{ color: "white", fontWeight: 600 }}>
                              {w.harvestConfirmed ? `${w.harvestedTrees} trees` : "0 trees (No Report)"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}


                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Confirmation/Alert Modal */}
        {confirmConfig && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "1rem"
          }}>
            <div className="mobile-scroll-modal modal-opening" style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}>
              {/* Header */}
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--surface-border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "white" }}>{confirmConfig.title}</h3>
              </div>
              
              {/* Body */}
              <div style={{ padding: "1.5rem", fontSize: "0.92rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
                {confirmConfig.message}
              </div>
              
              {/* Footer */}
              <div style={{
                padding: "1rem 1.5rem",
                background: "var(--surface-2)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                borderTop: "1px solid var(--surface-border)"
              }}>
                {!confirmConfig.isAlertOnly && (
                  <button
                    onClick={() => {
                      if (confirmConfig.onCancel) confirmConfig.onCancel();
                      setConfirmConfig(null);
                    }}
                    style={{
                      padding: "0.55rem 1.2rem",
                      background: "transparent",
                      color: "white",
                      border: "none",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "0.85rem"
                    }}
                  >
                    {confirmConfig.cancelLabel || "Cancel"}
                  </button>
                )}
                <button
                  onClick={async () => {
                    await confirmConfig.onConfirm();
                    setConfirmConfig(null);
                  }}
                  style={{
                    padding: "0.55rem 1.5rem",
                    background: confirmConfig.isAlertOnly 
                      ? "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" 
                      : "rgba(239,35,60,0.15)",
                    border: confirmConfig.isAlertOnly 
                      ? "none" 
                      : "1px solid var(--error)",
                    color: confirmConfig.isAlertOnly ? "white" : "var(--error)",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.85rem"
                  }}
                  onMouseEnter={(e) => {
                    if (!confirmConfig.isAlertOnly) {
                      e.currentTarget.style.background = "var(--error)";
                      e.currentTarget.style.color = "white";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!confirmConfig.isAlertOnly) {
                      e.currentTarget.style.background = "rgba(239,35,60,0.15)";
                      e.currentTarget.style.color = "var(--error)";
                    }
                  }}
                >
                  {confirmConfig.confirmLabel || (confirmConfig.isAlertOnly ? "OK" : "Delete")}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      <style dangerouslySetInnerHTML={{__html: `
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
