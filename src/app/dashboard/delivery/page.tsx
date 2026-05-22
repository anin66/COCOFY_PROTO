"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { useToast } from "@/context/ToastContext";
import { Search, Briefcase, Phone, MapPin, Calendar, TreePine, Users, Clock, CheckCircle, Truck } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { triggerPushNotification, getUidsByRole } from "@/lib/notifications";

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
  assignedDelivery?: { uid: string; name: string; status: "pending" | "confirmed" } | null;
}

export default function DeliveryDashboard() {
  const { showToast } = useToast();
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [userName, setUserName] = useState("Delivery");
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUid(user.uid);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserName(userDoc.data().name || "Delivery");
        }
      }
    });
    return () => unsub();
  }, []);

  // Real-time listener for jobs assigned to me
  useEffect(() => {
    if (!currentUid) return;
    const unsub = onSnapshot(collection(db, "jobs"), (snapshot) => {
      const jobs: Job[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.assignedDelivery?.uid === currentUid && data.status !== "ARCHIVED") {
          jobs.push({ ...data, id: d.id } as Job);
        }
      });
      jobs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMyJobs(jobs);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUid]);

  const handleConfirm = async (jobId: string) => {
    if (!currentUid) return;
    setConfirmingJobId(jobId);
    const oldJobs = [...myJobs];

    // Optimistic Update
    setMyJobs((prev) =>
      prev.map((job) => {
        if (job.id === jobId) {
          return {
            ...job,
            assignedDelivery: {
              uid: currentUid,
              name: userName,
              status: "confirmed" as const,
            },
            status: "ACTIVE",
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
      await updateDoc(jobRef, {
        assignedDelivery: { ...jobData.assignedDelivery, status: "confirmed" },
        status: "ACTIVE",
      });

      // Notify managers
      const location = jobData.location || "Unknown Location";
      getUidsByRole("manager").then((managers) => {
        triggerPushNotification(
          managers,
          "Delivery Confirmed",
          `Delivery Boy ${userName} confirmed pickup details for ${location}.`
        );
      });
    } catch (err) {
      console.error("Error confirming delivery:", err);
      setMyJobs(oldJobs);
      showToast("Failed to confirm. Please try again.", "error");
    } finally {
      setConfirmingJobId(null);
    }
  };

  const handleStartPickup = async (jobId: string) => {
    const oldJobs = [...myJobs];
    const job = myJobs.find((j) => j.id === jobId);
    const location = job?.location || "Unknown Location";

    // Optimistic Update
    setMyJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "PICKUP_STARTED" } : j))
    );

    try {
      const jobRef = doc(db, "jobs", jobId);
      await updateDoc(jobRef, {
        status: "PICKUP_STARTED",
      });

      // Notify managers
      getUidsByRole("manager").then((managers) => {
        triggerPushNotification(
          managers,
          "Pickup Started",
          `Delivery Boy ${userName} is en route to ${location} for pickup.`
        );
      });
    } catch (err) {
      console.error("Error starting pickup:", err);
      setMyJobs(oldJobs);
      showToast("Failed to start pickup. Please try again.", "error");
    }
  };

  const handleArrive = async (jobId: string) => {
    const oldJobs = [...myJobs];
    const job = myJobs.find((j) => j.id === jobId);
    const location = job?.location || "Unknown Location";

    // Optimistic Update
    setMyJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "ARRIVED_AT_DESTINATION" } : j))
    );

    try {
      const jobRef = doc(db, "jobs", jobId);
      await updateDoc(jobRef, {
        status: "ARRIVED_AT_DESTINATION",
      });

      // Notify managers
      getUidsByRole("manager").then((managers) => {
        triggerPushNotification(
          managers,
          "Delivery Arrived",
          `Delivery Boy ${userName} has arrived at ${location} with the harvest.`
        );
      });
    } catch (err) {
      console.error("Error updating arrival status:", err);
      setMyJobs(oldJobs);
      showToast("Failed to update arrival status. Please try again.", "error");
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={userName} userRole="DELIVERY BOY" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Delivery Portal" />

        <div style={{ padding: "2rem", flex: 1 }}>
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Job Requests</h3>
            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)" }} />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  style={{
                    background: "var(--surface)", border: "1px solid var(--surface-border)",
                    color: "white", padding: "0.6rem 1rem 0.6rem 2.5rem",
                    borderRadius: "8px", width: "250px", outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }} />
            </div>
          ) : myJobs.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "400px", background: "rgba(13,6,40,0.5)", backdropFilter: "blur(12px)",
              borderRadius: "16px", border: "1px dashed rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.4)", gap: "1rem",
            }}>
              <Truck size={48} strokeWidth={1.5} />
              <h4 style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.05em", margin: 0 }}>
                NO ACTIVE DELIVERY REQUESTS
              </h4>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {myJobs.map((job) => {
                const deliveryStatus = job.assignedDelivery?.status || "pending";
                const isConfirmed = deliveryStatus === "confirmed";
                const isConfirming = confirmingJobId === job.id;

                return (
                  <div
                    key={job.id}
                    className="job-card"
                    style={{ padding: "1.5rem", borderRadius: "16px" }}
                  >
                    {/* Status Badge */}
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.3rem 0.6rem", borderRadius: "100px",
                        fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em",
                        ...(job.status === "PICKUP_STARTED"
                          ? { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" }
                          : job.status === "ARRIVED_AT_DESTINATION"
                          ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", color: "#3b82f6" }
                          : job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED"
                          ? { background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981" }
                          : isConfirmed
                          ? { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }
                          : { background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#3b82f6" }),
                      }}>
                        {job.status === "PICKUP_STARTED" ? <Truck size={12} /> :
                         job.status === "ARRIVED_AT_DESTINATION" ? <MapPin size={12} /> :
                         job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED" ? <CheckCircle size={12} /> :
                         isConfirmed ? <CheckCircle size={12} /> : <Truck size={12} />}
                        
                        {job.status === "PICKUP_STARTED" ? "PICKUP STARTED" :
                         job.status === "ARRIVED_AT_DESTINATION" ? "ARRIVED AT DESTINATION" :
                         job.status === "WORK_COMPLETED" ? "WORK COMPLETED" :
                         job.status === "COMPLETED" || job.status === "ARCHIVED" ? "COMPLETED" :
                         isConfirmed ? "DELIVERY CONFIRMED" : "AWAITING CONFIRMATION"}
                      </div>
                    </div>

                    {/* Customer Name */}
                    <h4 style={{ fontSize: "1.35rem", margin: "0 0 1rem 0", fontWeight: 700 }}>{job.customerName}</h4>

                    {/* Details Grid — includes customer phone for delivery */}
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
                        <Calendar size={16} color="var(--accent)" className="icon-hover-effect" />
                        {job.date}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <TreePine size={16} color="var(--accent)" className="icon-hover-effect" />
                        Trees: {job.trees}
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

                    {/* Action Button */}
                    {!isConfirmed && (
                      <button
                        onClick={() => handleConfirm(job.id)}
                        disabled={isConfirming}
                        style={{
                          width: "100%", padding: "0.875rem",
                          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                          color: "white", border: "none", borderRadius: "12px",
                          fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                          opacity: isConfirming ? 0.6 : 1, transition: "opacity 0.2s",
                        }}
                      >
                        <CheckCircle size={18} />
                        {isConfirming ? "Confirming..." : "Confirm Delivery"}
                      </button>
                    )}

                    {isConfirmed && job.status === "ACTIVE" && (
                      <button
                        onClick={() => handleStartPickup(job.id)}
                        style={{
                          width: "100%", padding: "0.875rem",
                          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          color: "white", border: "none", borderRadius: "12px",
                          fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                          transition: "opacity 0.2s",
                        }}
                      >
                        <Truck size={18} />
                        Pickup Started
                      </button>
                    )}

                    {isConfirmed && job.status === "PICKUP_STARTED" && (
                      <button
                        onClick={() => handleArrive(job.id)}
                        style={{
                          width: "100%", padding: "0.875rem",
                          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                          color: "white", border: "none", borderRadius: "12px",
                          fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                          transition: "opacity 0.2s",
                        }}
                      >
                        <MapPin size={18} />
                        Arrived at Destination
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

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
          background: rgba(255, 255, 255, 0.03);
          box-shadow: 0 25px 45px -15px rgba(123, 44, 191, 0.4),
                      0 0 30px -5px rgba(255, 0, 127, 0.15);
        }
        .job-card::after {
          content: '';
          position: absolute;
          top: 0; left: -150%;
          width: 50%; height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0) 100%);
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

        @media (max-width: 768px) {
          .flex-stack-mobile {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1.25rem !important;
          }
          .flex-stack-mobile > div {
            width: 100% !important;
          }
          .flex-stack-mobile input {
            width: 100% !important;
          }
        }
      `}} />
    </div>
  );
}
