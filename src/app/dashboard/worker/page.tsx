"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { Search, Briefcase, MapPin, Calendar, TreePine, Users, Clock, CheckCircle, XCircle } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, getDoc, increment } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/context/ToastContext";
import { triggerPushNotification } from "@/lib/notifications";
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
  time?: string;
  assignedWorkers?: AssignedWorker[];
}

export default function WorkerDashboard() {
  const { showToast } = useToast();
  const router = useRouter();
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [userName, setUserName] = useState("Worker");
  const [userRole, setUserRole] = useState("worker");
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingJobId, setRespondingJobId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectJobId, setRejectJobId] = useState<string | null>(null);
  const [harvestCounts, setHarvestCounts] = useState<Record<string, number>>({});

  // Get current user and redirect if not a worker
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUid(user.uid);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const role = data.role || "worker";
          setUserName(data.name || "Worker");
          setUserRole(role);
          // Redirect non-workers to their correct dashboard
          if (role !== "worker") {
            router.replace(`/dashboard/${role}`);
          }
        }
      } else {
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // Real-time listener for jobs assigned to me
  useEffect(() => {
    if (!currentUid) return;
    const unsub = onSnapshot(collection(db, "jobs"), (snapshot) => {
      const jobs: Job[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const assignedWorkers = (data.assignedWorkers || []) as AssignedWorker[];
        if (assignedWorkers.some((w) => w.uid === currentUid) && data.status !== "ARCHIVED") {
          jobs.push({ ...data, id: d.id } as Job);
        }
      });
      jobs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMyJobs(jobs);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUid]);

  const handleRespond = async (jobId: string, response: "accepted" | "rejected") => {
    if (!currentUid) return;
    setRespondingJobId(jobId);
    const oldJobs = [...myJobs];

    // Optimistic Update
    setMyJobs((prevJobs) =>
      prevJobs.map((job) => {
        if (job.id === jobId) {
          const updatedWorkers = (job.assignedWorkers || []).map((w) =>
            w.uid === currentUid ? { ...w, status: response } : w
          );
          const acceptedCount = updatedWorkers.filter((w) => w.status === "accepted").length;
          const allAccepted = acceptedCount >= job.workersRequired;
          return {
            ...job,
            assignedWorkers: updatedWorkers,
            status: allAccepted ? "TEAM_READY" : job.status,
          };
        }
        return job;
      })
    );

    try {
      const jobRef = doc(db, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
      if (!jobSnap.exists()) return;

      const jobData = jobSnap.data();
      const workers: AssignedWorker[] = jobData.assignedWorkers || [];
      const updatedWorkers = workers.map((w) =>
        w.uid === currentUid ? { ...w, status: response } : w
      );

      // Check if all required workers accepted
      const acceptedCount = updatedWorkers.filter((w) => w.status === "accepted").length;
      const allAccepted = acceptedCount >= jobData.workersRequired;

      await updateDoc(jobRef, {
        assignedWorkers: updatedWorkers,
        ...(allAccepted ? { status: "TEAM_READY" } : {}),
      });

      // Update worker ranking points in their user document
      const userRef = doc(db, "users", currentUid);
      await updateDoc(userRef, {
        rankingPoints: increment(response === "accepted" ? 10 : -10),
      });

      // Notify managers about job accept/reject
      triggerPushNotification(
        [],
        response === "accepted" ? "Job Accepted" : "Job Rejected",
        `Worker ${userName} has ${response === "accepted" ? "accepted" : "rejected"} job at ${jobData.location || "Unknown Location"}.`,
        undefined,
        ["manager"]
      );
    } catch (err) {
      console.error("Error responding to job:", err);
      setMyJobs(oldJobs);
      showToast("Failed to respond. Please try again.", "error");
    } finally {
      setRespondingJobId(null);
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    const oldJobs = [...myJobs];
    const job = myJobs.find((j) => j.id === jobId);
    const location = job?.location || "Unknown Location";

    // Optimistic Update
    setMyJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "WORK_COMPLETED" } : j))
    );

    try {
      const jobRef = doc(db, "jobs", jobId);
      await updateDoc(jobRef, {
        status: "WORK_COMPLETED",
      });
      showToast("Job completed successfully.", "success");

      // Notify managers
      triggerPushNotification(
        [],
        "Job Completed",
        `Harvesting work has been completed at ${location}.`,
        undefined,
        ["manager"]
      );
    } catch (err) {
      console.error("Error completing job:", err);
      setMyJobs(oldJobs);
      showToast("Failed to complete job. Please try again.", "error");
    }
  };

  const handleConfirmHarvest = async (jobId: string, harvestCount: number) => {
    if (!currentUid) return;
    const oldJobs = [...myJobs];

    // Optimistic Update
    setMyJobs((prev) =>
      prev.map((job) => {
        if (job.id === jobId) {
          const updatedWorkers = (job.assignedWorkers || []).map((w) =>
            w.uid === currentUid
              ? { ...w, harvestedTrees: harvestCount, harvestConfirmed: true }
              : w
          );
          return { ...job, assignedWorkers: updatedWorkers };
        }
        return job;
      })
    );

    try {
      const jobRef = doc(db, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
      if (!jobSnap.exists()) return;

      const jobData = jobSnap.data();
      const workers: AssignedWorker[] = jobData.assignedWorkers || [];
      const updatedWorkers = workers.map((w) => {
        if (w.uid === currentUid) {
          return {
            ...w,
            harvestedTrees: harvestCount,
            harvestConfirmed: true,
          };
        }
        return w;
      });

      await updateDoc(jobRef, {
        assignedWorkers: updatedWorkers,
      });
      showToast("Harvest confirmed successfully.", "success");

      const location = jobData.location || "Unknown Location";

      // 8. Trigger push notification for harvest recorded
      triggerPushNotification(
        [],
        "Harvest Recorded",
        `${userName} recorded harvesting ${harvestCount} trees at ${location}.`,
        undefined,
        ["manager"]
      );

      // 9. Trigger push notification for final harvest complete if all workers have entered tree counts
      const allEntered = updatedWorkers.every((w) => w.harvestConfirmed);
      if (allEntered) {
        const totalHarvested = updatedWorkers.reduce((sum, w) => sum + (w.harvestedTrees || 0), 0);
        
        // Trigger push notification to managers and finance
        triggerPushNotification(
          [],
          "Harvest Fully Finalized",
          `All workers have entered tree counts for ${location}. Total harvested: ${totalHarvested}.`,
          undefined,
          ["manager", "finance"]
        );
      }
    } catch (err) {
      console.error("Error confirming harvest:", err);
      setMyJobs(oldJobs);
      showToast("Failed to confirm harvest. Please try again.", "error");
    }
  };

  const getMyStatus = (job: Job): string => {
    if (!currentUid) return "pending";
    const w = job.assignedWorkers?.find((w) => w.uid === currentUid);
    return w?.status || "pending";
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={userName} userRole={userRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Worker Portal" />

        <div className="worker-page-container" style={{ padding: "2rem", flex: 1 }}>
          <div className="worker-header-row flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Job Requests</h3>
            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  style={{
                    background: "var(--surface)", border: "1px solid var(--surface-border)",
                    color: "var(--foreground)", padding: "0.6rem 1rem 0.6rem 2.5rem",
                    borderRadius: "8px", width: "250px", outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="job-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : myJobs.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "400px", background: "rgba(13,6,40,0.5)", backdropFilter: "blur(12px)",
              borderRadius: "16px", border: "1px dashed var(--surface-border)", color: "var(--text-dim)", gap: "1rem",
            }}>
              <Briefcase size={48} strokeWidth={1.5} />
              <h4 style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.05em", margin: 0 }}>
                NO ACTIVE JOB REQUESTS
              </h4>
            </div>
          ) : (
            <div className="job-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {myJobs.map((job) => {
                const myStatus = getMyStatus(job);
                const isPending = myStatus === "pending";
                const isResponding = respondingJobId === job.id;

                return (
                  <div
                    key={job.id}
                    className="job-card"
                    style={{ padding: "1.5rem", borderRadius: "16px" }}
                  >
                    {/* Status Badges */}
                    <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.3rem 0.6rem", borderRadius: "100px",
                        fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em",
                        ...(myStatus === "accepted"
                          ? { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }
                          : myStatus === "rejected"
                          ? { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }
                          : { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }),
                      }}>
                        {myStatus === "accepted" ? <CheckCircle size={12} /> :
                         myStatus === "rejected" ? <XCircle size={12} /> :
                         <Clock size={12} />}
                        {myStatus === "accepted" ? "ACCEPTED" : myStatus === "rejected" ? "REJECTED" : "PENDING RESPONSE"}
                      </div>

                      {myStatus === "accepted" && (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: "0.4rem",
                          padding: "0.3rem 0.6rem", borderRadius: "100px",
                          fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em",
                          ...(job.status === "ACTIVE"
                            ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", color: "#3b82f6" }
                            : job.status === "PICKUP_STARTED"
                            ? { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" }
                            : job.status === "ARRIVED_AT_DESTINATION"
                            ? { background: "var(--accent-glow)", border: "1px solid var(--accent)", color: "var(--accent)" }
                            : job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED"
                            ? { background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981" }
                            : { background: "var(--surface-2)", border: "1px solid var(--surface-border)", color: "var(--text-light)" }),
                        }}>
                          {job.status === "ACTIVE" ? "ACTIVE" :
                           job.status === "PICKUP_STARTED" ? "PICKUP STARTED" :
                           job.status === "ARRIVED_AT_DESTINATION" ? "ARRIVED" :
                           job.status === "WORK_COMPLETED" ? "WORK COMPLETED" :
                           job.status === "COMPLETED" || job.status === "ARCHIVED" ? "COMPLETED" :
                           "PENDING START"}
                        </div>
                      )}
                    </div>

                    {/* Customer Name (NO phone for privacy) */}
                    <h4 style={{ fontSize: "1.35rem", margin: "0 0 1rem 0", fontWeight: 700 }}>{job.customerName}</h4>

                    {/* Details Grid — no phone number */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "1.5rem", fontSize: "0.88rem", color: "var(--text-muted)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={16} color="var(--accent)" className="icon-hover-effect" />
                        {job.location}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Calendar size={16} color="var(--accent)" className="icon-hover-effect" />
                        {job.date}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <TreePine size={16} color="var(--accent)" className="icon-hover-effect" />
                        Trees: {job.trees}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Users size={16} color="var(--accent)" className="icon-hover-effect" />
                        Team: {job.workersRequired}
                      </div>
                      {job.time && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Clock size={16} color="var(--accent)" className="icon-hover-effect" />
                          Time: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{job.time}</span>
                        </div>
                      )}
                      {job.pricePerTree && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Briefcase size={16} color="var(--accent)" className="icon-hover-effect" />
                          {job.pricePerTree}
                        </div>
                      )}
                    </div>

                    {/* Accept / Reject Buttons */}
                    {isPending && (
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        <button
                          onClick={() => handleRespond(job.id, "accepted")}
                          disabled={isResponding}
                          style={{
                            flex: 1, padding: "0.8rem",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            color: "white", border: "none", borderRadius: "12px",
                            fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                            opacity: isResponding ? 0.6 : 1, transition: "opacity 0.2s",
                          }}
                        >
                          <CheckCircle size={18} />
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            setRejectJobId(job.id);
                            setShowRejectModal(true);
                          }}
                          disabled={isResponding}
                          style={{
                            flex: 1, padding: "0.8rem",
                            background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                            color: "white", border: "none", borderRadius: "12px",
                            fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                            opacity: isResponding ? 0.6 : 1, transition: "opacity 0.2s",
                          }}
                        >
                          <XCircle size={18} />
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Worker Action Buttons for active job workflow */}
                    {myStatus === "accepted" && job.status === "ARRIVED_AT_DESTINATION" && (
                      <button
                        onClick={() => handleCompleteJob(job.id)}
                        style={{
                          width: "100%", padding: "0.875rem",
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          color: "white", border: "none", borderRadius: "12px",
                          fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                          transition: "opacity 0.2s",
                        }}
                      >
                        <CheckCircle size={18} />
                        Job Completed
                      </button>
                    )}

                    {myStatus === "accepted" && (job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED") && (() => {
                      const myWorkerInfo = job.assignedWorkers?.find(w => w.uid === currentUid);
                      const hasConfirmedHarvest = myWorkerInfo?.harvestConfirmed || false;
                      const myHarvestedTrees = myWorkerInfo?.harvestedTrees || 0;

                      if (hasConfirmedHarvest) {
                        return (
                          <div style={{
                            padding: "1rem",
                            borderRadius: "12px",
                            background: "rgba(16,185,129,0.08)",
                            border: "1px solid rgba(16,185,129,0.2)",
                            color: "#10b981",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            textAlign: "center",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.5rem"
                          }}>
                            <CheckCircle size={16} />
                            Harvest Reported: {myHarvestedTrees} {myHarvestedTrees === 1 ? 'tree' : 'trees'}
                          </div>
                        );
                      }

                      return (
                        <div style={{
                          padding: "1rem",
                          borderRadius: "12px",
                          background: "var(--surface-1)",
                          border: "1px solid var(--surface-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem"
                        }}>
                          <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
                            Enter Harvested Trees
                          </label>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            <input
                              type="number"
                              min="0"
                              placeholder="Number of trees"
                              value={harvestCounts[job.id] ?? ""}
                              onChange={(e) => setHarvestCounts({
                                ...harvestCounts,
                                [job.id]: parseInt(e.target.value) || 0
                              })}
                              style={{
                                width: "100%",
                                background: "var(--surface-2)",
                                border: "1px solid var(--surface-border)",
                                color: "white",
                                padding: "0.6rem 0.8rem",
                                borderRadius: "8px",
                                outline: "none",
                                fontSize: "0.9rem",
                                fontFamily: "inherit"
                              }}
                            />
                            <button
                              onClick={() => {
                                const count = harvestCounts[job.id] ?? 0;
                                handleConfirmHarvest(job.id, count);
                              }}
                              style={{
                                width: "100%",
                                padding: "0.6rem 1.2rem",
                                background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                fontWeight: 600,
                                cursor: "pointer",
                                fontSize: "0.9rem",
                                fontFamily: "inherit"
                              }}
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Reject Confirmation Dialog */}
      {showRejectModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "1rem",
        }}>
          <div className="mobile-scroll-modal" style={{
            background: "var(--surface)",
            border: "1px solid var(--surface-border)",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "420px",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            animation: "modal-in 0.3s ease-out",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(239, 35, 60, 0.1)",
                color: "var(--error)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
                fontSize: "1.5rem",
              }}>
                ⚠️
              </div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Reject Job Request?</h3>
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Are you sure you want to reject this job?
                <br />
                <span style={{ color: "#ef4444", fontWeight: 700 }}>10 ranking points will be deducted</span> from your profile.
              </p>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectJobId(null);
                }}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  borderRadius: "10px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--surface-border)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (rejectJobId) {
                    handleRespond(rejectJobId, "rejected");
                  }
                  setShowRejectModal(false);
                  setRejectJobId(null);
                }}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                  border: "none",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
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
          background: var(--surface-1);
          box-shadow: 0 25px 45px -15px var(--accent-glow-border),
                      0 0 30px -5px var(--primary-glow-border);
        }
        .job-card::after {
          content: '';
          position: absolute;
          top: 0; left: -150%;
          width: 50%; height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, var(--surface-border) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-25deg);
          transition: none;
          pointer-events: none;
        }
        .job-card:hover::after {
          left: 150%;
          transition: left 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .icon-hover-effect {
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.3s ease;
        }
        .job-card:hover .icon-hover-effect {
          transform: scale(1.22) rotate(6deg);
          color: #ff007f !important;
        }
        
        @media (max-width: 1150px) {
          .worker-page-container {
            padding: 1rem !important;
          }
          .worker-header-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1rem !important;
          }
          .worker-header-row div {
            width: 100% !important;
          }
          .worker-header-row input {
            width: 100% !important;
          }
        }
      `}} />
    </div>
  );
}
