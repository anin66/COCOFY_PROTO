"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { 
  Search, Plus, X, Briefcase, Phone, 
  MapPin, Calendar, Users, TreePine, 
  FileText, MoreVertical, Edit, Trash2, AlertTriangle,
  Clock, Truck, CheckCircle, XCircle, RefreshCw
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/ui/DatePicker";
import AssignTeamModal from "@/components/dashboard/AssignTeamModal";
import AssignDeliveryModal from "@/components/dashboard/AssignDeliveryModal";
import { useToast } from "@/context/ToastContext";

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
  status: "UNCONFIRMED" | "CONFIRMED" | "TEAM_PENDING" | "TEAM_READY" | "DELIVERY_PENDING" | "ACTIVE" | "COMPLETED" | "PICKUP_STARTED" | "ARRIVED_AT_DESTINATION" | "WORK_COMPLETED" | "ARCHIVED";
  createdAt: string;
  time?: string;
  assignedWorkers?: AssignedWorker[];
  assignedDelivery?: AssignedDelivery | null;
}

export default function ManagerDashboard() {
  const { showToast } = useToast();
  const router = useRouter();
  const [currentUserName, setCurrentUserName] = useState("Manager");
  const [currentUserRole, setCurrentUserRole] = useState("manager");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

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
  
  // Animation & Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [newlyCreatedJobId, setNewlyCreatedJobId] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    location: "",
    date: "",
    trees: 1,
    workersRequired: 1,
    pricePerTree: "",
  });

  // Dropdown, Edit & Delete states
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditModalClosing, setIsEditModalClosing] = useState(false);
  const [deleteConfirmJob, setDeleteConfirmJob] = useState<Job | null>(null);
  const [isDeleteModalClosing, setIsDeleteModalClosing] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // Assign Team & Delivery modal states
  const [assignTeamJobId, setAssignTeamJobId] = useState<string | null>(null);
  const [assignTeamWorkersRequired, setAssignTeamWorkersRequired] = useState(1);
  const [assignTeamExcludeUids, setAssignTeamExcludeUids] = useState<string[]>([]);
  const [assignDeliveryJobId, setAssignDeliveryJobId] = useState<string | null>(null);

  // Confirm Job Details Modal states
  const [confirmingJob, setConfirmingJob] = useState<Job | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmModalClosing, setIsConfirmModalClosing] = useState(false);
  const [confirmStartTime, setConfirmStartTime] = useState("");
  const [confirmSelectedPrice, setConfirmSelectedPrice] = useState("Price (₹30/tree)");

  const [editFormData, setEditFormData] = useState({
    id: "",
    customerName: "",
    phone: "",
    location: "",
    date: "",
    trees: 1,
    workersRequired: 1,
    pricePerTree: "",
    status: "UNCONFIRMED" as Job["status"],
    createdAt: "",
  });

  const handleEditClick = (job: Job) => {
    setEditingJob(job);
    setEditFormData({
      id: job.id,
      customerName: job.customerName,
      phone: job.phone,
      location: job.location,
      date: job.date,
      trees: job.trees,
      workersRequired: job.workersRequired,
      pricePerTree: job.pricePerTree,
      status: job.status,
      createdAt: job.createdAt,
    });
    setIsEditModalOpen(true);
    setActiveDropdownId(null);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const oldJobs = [...jobs];
    const { id, ...updatedFields } = editFormData;

    // Optimistic Update
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? ({ ...job, ...updatedFields } as Job) : job))
    );

    // Close modal instantly
    setIsEditModalClosing(true);
    setTimeout(() => {
      setIsEditModalOpen(false);
      setIsEditModalClosing(false);
      setEditingJob(null);
    }, 350);

    try {
      const jobRef = doc(db, "jobs", id);
      await updateDoc(jobRef, updatedFields);
      showToast("Job updated successfully.", "success");
    } catch (error) {
      console.error("Error updating job:", error);
      showToast("Failed to update job.", "error");
      setJobs(oldJobs);
    }
  };

  const closeEditModal = () => {
    setIsEditModalClosing(true);
    setTimeout(() => {
      setIsEditModalOpen(false);
      setIsEditModalClosing(false);
      setEditingJob(null);
    }, 400);
  };

  const handleDeleteClick = (job: Job) => {
    setDeleteConfirmJob(job);
    setActiveDropdownId(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalClosing(true);
    setTimeout(() => {
      setDeleteConfirmJob(null);
      setIsDeleteModalClosing(false);
    }, 400);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmJob) return;
    const jobId = deleteConfirmJob.id;
    setSubmitting(true);
    try {
      // Close the modal instantly with zero delay
      setDeleteConfirmJob(null);
      setIsDeleteModalClosing(false);

      // Trigger Firestore delete in background asynchronously
      deleteDoc(doc(db, "jobs", jobId)).then(() => {
        showToast("Job deleted successfully.", "success");
      }).catch((error) => {
        console.error("Firestore delete error:", error);
        showToast("Failed to remove job from server.", "error");
      });

      // Filter local state instantly to trigger instantaneous card rearrangement
      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      setSubmitting(false);
    } catch (error) {
      console.error("Error confirming delete:", error);
      showToast("Failed to delete job.", "error");
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // Real-time listener for live job updates
    const unsubscribe = onSnapshot(collection(db, "jobs"), (snapshot) => {
      const jobsList: Job[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status !== "ARCHIVED") {
          jobsList.push({ ...data, id: d.id } as Job);
        }
      });
      jobsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJobs(jobsList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to jobs:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const closeModal = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsModalClosing(false);
    }, 400); // Wait for modalOut animation to finish
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const newJob = {
        ...formData,
        status: "UNCONFIRMED",
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, "jobs"), newJob);
      
      // Start the modal closing animation
      setIsModalClosing(true);
      
      // Right before the modal completely disappears, pop in the new card
      setTimeout(() => {
        setIsModalOpen(false);
        setIsModalClosing(false);
        
        // Store new job id to trigger the 'wow' bounce animation when snapshot adds it
        setNewlyCreatedJobId(docRef.id);
        
        // Reset form
        setFormData({
          customerName: "",
          phone: "",
          location: "",
          date: "",
          trees: 1,
          workersRequired: 1,
          pricePerTree: "",
        });
        setSubmitting(false);

        // Remove the animation class from the card after it finishes playing
        setTimeout(() => setNewlyCreatedJobId(null), 1000);
        showToast("Job created successfully.", "success");
      }, 350); 
      
    } catch (error) {
      console.error("Error creating job:", error);
      showToast("Failed to create job.", "error");
      setSubmitting(false);
    }
  };

  const handleConfirmOrder = (job: Job) => {
    setConfirmingJob(job);
    setConfirmStartTime("");
    setConfirmSelectedPrice(job.pricePerTree || "");
    setIsConfirmModalOpen(true);
  };

  const handleConfirmJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingJob) return;
    if (!confirmStartTime.trim()) {
      showToast("Please select or input an exact start time.", "warning");
      return;
    }

    const oldJobs = [...jobs];
    const updateData = {
      status: "CONFIRMED" as const,
      time: confirmStartTime,
      pricePerTree: confirmSelectedPrice
    };

    // Optimistic Update
    setJobs((prev) => 
      prev.map((job) => 
        job.id === confirmingJob.id 
          ? { ...job, ...updateData } as Job 
          : job
      )
    );

    // Close modal instantly with transition
    setIsConfirmModalClosing(true);
    setTimeout(() => {
      setIsConfirmModalOpen(false);
      setIsConfirmModalClosing(false);
      setConfirmingJob(null);
    }, 350);

    try {
      const jobRef = doc(db, "jobs", confirmingJob.id);
      await updateDoc(jobRef, updateData);
      showToast("Job confirmed successfully.", "success");
    } catch (error) {
      console.error("Error confirming job:", error);
      showToast("Failed to confirm job.", "error");
      setJobs(oldJobs);
    }
  };

  const handleArchiveJob = async (jobId: string) => {
    const oldJobs = [...jobs];

    // Optimistic Update
    setJobs((prev) => prev.filter((job) => job.id !== jobId));

    try {
      const jobRef = doc(db, "jobs", jobId);
      await updateDoc(jobRef, {
        status: "ARCHIVED",
      });
      showToast("Job archived successfully.", "success");
    } catch (error) {
      console.error("Error archiving job:", error);
      showToast("Failed to archive job.", "error");
      setJobs(oldJobs);
    }
  };

  const closeConfirmModal = () => {
    setIsConfirmModalClosing(true);
    setTimeout(() => {
      setIsConfirmModalOpen(false);
      setIsConfirmModalClosing(false);
      setConfirmingJob(null);
    }, 350);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      {/* Sidebar */}
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        <TopBar title="Managers Dashboard" />

        <div style={{ padding: "2rem", flex: 1 }}>
          
          {/* Section Header */}
          <div className="flex-stack-mobile" style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "2rem" 
          }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Job Requests</h3>
            
            <div className="flex-stack-mobile" style={{ display: "flex", gap: "1rem", width: "100%", maxWidth: "500px", justifyContent: "flex-end" }}>
              {/* Search Bar */}
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)" }} />
                <input 
                  type="text" 
                  placeholder="Search customer/location..." 
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--surface-border)",
                    color: "white",
                    padding: "0.6rem 1rem 0.6rem 2.5rem",
                    borderRadius: "8px",
                    width: "100%",
                    outline: "none",
                    fontFamily: "inherit"
                  }} 
                />
              </div>

              {/* New Job Button */}
              <button 
                onClick={() => setIsModalOpen(true)}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  gap: "0.5rem", 
                  padding: "0.6rem 1.2rem",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                  whiteSpace: "nowrap"
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                <Plus size={18} />
                New Job
              </button>
            </div>
          </div>

          {/* Job Requests Content Area */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }}></div>
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
              color: "rgba(255,255,255,0.5)"
            }}>
              <p>No active job requests. Click 'New Job' to create one.</p>
            </div>
          ) : (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
              gap: "1.5rem" 
            }}>
              {jobs.map((job) => (
                <div key={job.id} 
                  className={`job-card ${job.id === newlyCreatedJobId ? "new-card-anim" : ""} ${job.id === deletingJobId ? "delete-card-anim" : ""}`}
                  style={{
                  padding: "1.5rem",
                  borderRadius: "16px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    {(() => {
                      const statusConfig: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode; label: string }> = {
                        UNCONFIRMED: { bg: "rgba(217,119,6,0.1)", border: "rgba(217,119,6,0.3)", color: "#d97706", icon: <Clock size={12} />, label: "AWAITING RESPONSE" },
                        CONFIRMED: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", color: "#10b981", icon: <FileText size={12} />, label: "CONFIRMED" },
                        TEAM_PENDING: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", color: "#f59e0b", icon: <Users size={12} />, label: "TEAM PENDING" },
                        TEAM_READY: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", color: "#10b981", icon: <CheckCircle size={12} />, label: "TEAM READY" },
                        DELIVERY_PENDING: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", color: "#3b82f6", icon: <Truck size={12} />, label: "DELIVERY PENDING" },
                        ACTIVE: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.5)", color: "#10b981", icon: <CheckCircle size={12} />, label: "ACTIVE" },
                        PICKUP_STARTED: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.5)", color: "#f59e0b", icon: <Truck size={12} />, label: "PICKUP STARTED" },
                        ARRIVED_AT_DESTINATION: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.5)", color: "#3b82f6", icon: <MapPin size={12} />, label: "ARRIVED AT DESTINATION" },
                        WORK_COMPLETED: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.5)", color: "#10b981", icon: <CheckCircle size={12} />, label: "WORK COMPLETED" },
                      };
                      const cfg = statusConfig[job.status] || statusConfig.UNCONFIRMED;
                      return (
                        <div style={{
                          display: "flex", alignItems: "center", gap: "0.4rem",
                          background: cfg.bg, padding: "0.3rem 0.6rem",
                          borderRadius: "100px", border: `1px solid ${cfg.border}`,
                          fontSize: "0.7rem", fontWeight: 600,
                          letterSpacing: "0.05em", color: cfg.color,
                        }}>
                          {cfg.icon}
                          {cfg.label}
                        </div>
                      );
                    })()}
                    
                    <div style={{ position: "relative" }}>
                      <button 
                        onClick={() => setActiveDropdownId(activeDropdownId === job.id ? null : job.id)}
                        style={{ 
                          background: "none", 
                          border: "none", 
                          color: activeDropdownId === job.id ? "white" : "rgba(255,255,255,0.5)", 
                          cursor: "pointer",
                          padding: "0.25rem",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background 0.2s, color 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          if (activeDropdownId !== job.id) {
                            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                            e.currentTarget.style.color = "white";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeDropdownId !== job.id) {
                            e.currentTarget.style.background = "none";
                            e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                          }
                        }}
                      >
                        <MoreVertical size={18} />
                      </button>

                      {/* Dropdown Menu */}
                      {activeDropdownId === job.id && (
                        <>
                          <div 
                            onClick={() => setActiveDropdownId(null)}
                            style={{
                              position: "fixed",
                              inset: 0,
                              zIndex: 10,
                              cursor: "default"
                            }}
                          />
                          <div style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            marginTop: "0.5rem",
                            background: "var(--surface)",
                            border: "1px solid var(--surface-border)",
                            borderRadius: "10px",
                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
                            width: "140px",
                            zIndex: 11,
                            overflow: "hidden",
                            animation: "dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                          }}>
                            <button
                              onClick={() => handleEditClick(job)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                width: "100%",
                                padding: "0.75rem 1rem",
                                background: "none",
                                border: "none",
                                color: "rgba(255,255,255,0.8)",
                                fontSize: "0.85rem",
                                fontWeight: 550,
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                                e.currentTarget.style.color = "var(--accent)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                              }}
                            >
                              <Edit size={14} />
                              Edit Job
                            </button>

                            <div style={{ height: "1px", background: "var(--surface-border)" }} />

                            <button
                              onClick={() => handleDeleteClick(job)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                width: "100%",
                                padding: "0.75rem 1rem",
                                background: "none",
                                border: "none",
                                color: "rgba(239, 68, 68, 0.8)",
                                fontSize: "0.85rem",
                                fontWeight: 550,
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                e.currentTarget.style.color = "rgb(239, 68, 68)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color = "rgba(239, 68, 68, 0.8)";
                              }}
                            >
                              <Trash2 size={14} />
                              Delete Job
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Customer Name */}
                  <h4 style={{ fontSize: "1.5rem", margin: "0 0 1rem 0", fontWeight: 700 }}>{job.customerName}</h4>

                  {/* Grid of details */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem", fontSize: "0.9rem", color: "rgba(255,255,255,0.8)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Phone size={16} color="var(--accent)" className="icon-hover-effect" />
                      {job.phone}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Users size={16} color="var(--accent)" className="icon-hover-effect" />
                      Team: <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                        {(job.assignedWorkers?.filter(w => w.status === "accepted").length) || 0}/{job.workersRequired}
                      </span>
                    </div>
                    {job.status !== "UNCONFIRMED" && job.time && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Clock size={16} color="var(--accent)" className="icon-hover-effect" />
                        Time: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{job.time}</span>
                      </div>
                    )}
                  </div>

                  {/* Worker Status List (for TEAM_PENDING) */}
                  {job.status === "TEAM_PENDING" && job.assignedWorkers && job.assignedWorkers.length > 0 && (
                    <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {job.assignedWorkers.map((w, idx) => (
                        <div key={idx} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "0.5rem 0.75rem", borderRadius: "8px",
                          background: w.status === "accepted" ? "rgba(16,185,129,0.08)" : w.status === "rejected" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${w.status === "accepted" ? "rgba(16,185,129,0.25)" : w.status === "rejected" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.08)"}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                            {w.status === "accepted" ? <CheckCircle size={14} /> :
                             w.status === "rejected" ? <XCircle size={14} color="#ef4444" /> :
                             <Clock size={14} color="#f59e0b" />}
                            <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{w.name}</span>
                          </div>
                          <span style={{
                            fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
                            color: w.status === "accepted" ? "#10b981" : w.status === "rejected" ? "#ef4444" : "#f59e0b",
                          }}>{w.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Worker Harvest List (for WORK_COMPLETED) */}
                  {job.status === "WORK_COMPLETED" && job.assignedWorkers && job.assignedWorkers.length > 0 && (
                    <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                        Harvest Reports
                      </div>
                      {job.assignedWorkers.filter(w => w.status === "accepted").map((w, idx) => (
                        <div key={idx} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "0.5rem 0.75rem", borderRadius: "8px",
                          background: w.harvestConfirmed ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${w.harvestConfirmed ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                            {w.harvestConfirmed ? <CheckCircle size={14} color="#10b981" /> : <Clock size={14} color="#f59e0b" />}
                            <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{w.name}</span>
                          </div>
                          <span style={{
                            fontSize: "0.8rem", fontWeight: 600,
                            color: w.harvestConfirmed ? "#10b981" : "#f59e0b",
                          }}>
                            {w.harvestConfirmed ? `${w.harvestedTrees} trees` : "PENDING"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {job.status === "UNCONFIRMED" && (
                    <button 
                      onClick={() => handleConfirmOrder(job)}
                      style={{
                        width: "100%", padding: "0.875rem",
                        background: "#2563eb", color: "white",
                        border: "none", borderRadius: "12px",
                        fontWeight: 600, cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#1d4ed8"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#2563eb"}
                    >
                      Set Harvest Time
                    </button>
                  )}

                  {job.status === "CONFIRMED" && (
                    <button 
                      onClick={() => {
                        setAssignTeamJobId(job.id);
                        setAssignTeamWorkersRequired(job.workersRequired);
                        setAssignTeamExcludeUids([]);
                      }}
                      style={{
                        width: "100%", padding: "0.875rem",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        color: "white", border: "none", borderRadius: "12px",
                        fontWeight: 600, cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                      }}
                    >
                      <Users size={18} />
                      Assign Team
                    </button>
                  )}

                  {job.status === "TEAM_PENDING" && job.assignedWorkers?.some(w => w.status === "rejected") && (
                    <button 
                      onClick={() => {
                        const acceptedUids = job.assignedWorkers?.filter(w => w.status === "accepted").map(w => w.uid) || [];
                        const slotsNeeded = job.workersRequired - acceptedUids.length;
                        setAssignTeamJobId(job.id);
                        setAssignTeamWorkersRequired(slotsNeeded);
                        setAssignTeamExcludeUids(acceptedUids);
                      }}
                      style={{
                        width: "100%", padding: "0.875rem",
                        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        color: "white", border: "none", borderRadius: "12px",
                        fontWeight: 600, cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                      }}
                    >
                      <RefreshCw size={16} />
                      Reassign Workers
                    </button>
                  )}

                  {job.status === "TEAM_READY" && (
                    <button 
                      onClick={() => setAssignDeliveryJobId(job.id)}
                      style={{
                        width: "100%", padding: "0.875rem",
                        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        color: "white", border: "none", borderRadius: "12px",
                        fontWeight: 600, cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                      }}
                    >
                      <Truck size={18} />
                      Assign Delivery
                    </button>
                  )}

                  {job.status === "WORK_COMPLETED" && (() => {
                    const acceptedWorkers = job.assignedWorkers?.filter(w => w.status === "accepted") || [];
                    const allHarvestsConfirmed = acceptedWorkers.length > 0 && acceptedWorkers.every(w => w.harvestConfirmed);

                    return allHarvestsConfirmed ? (
                      <button 
                        onClick={() => handleArchiveJob(job.id)}
                        style={{
                          width: "100%", padding: "0.875rem",
                          background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                          color: "white", border: "none", borderRadius: "12px",
                          fontWeight: 600, cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                        }}
                      >
                        <FileText size={18} />
                        Archive to History
                      </button>
                    ) : (
                      <div style={{
                        width: "100%", padding: "0.875rem",
                        background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.4)",
                        borderRadius: "12px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        textAlign: "center",
                        border: "1px dashed var(--surface-border)"
                      }}>
                        Waiting for all worker harvest reports...
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Create New Job Modal */}
        {isModalOpen && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: isModalClosing ? "rgba(0, 0, 0, 0)" : "rgba(0, 0, 0, 0.6)",
            backdropFilter: isModalClosing ? "blur(0px)" : "blur(4px)",
            transition: "all 0.4s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}>
            <div 
              className={`mobile-scroll-modal ${isModalClosing ? "modal-closing" : "modal-opening"}`}
              style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "550px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}>
              {/* Modal Header */}
              <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Briefcase size={24} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Create New Job</h2>
                </div>
                <button 
                  onClick={closeModal}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "2rem" }}>
                <p style={{ margin: "0 0 2rem 0", color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Set up a new coconut harvesting task. Specify the trees and team size needed.
                </p>

                <form id="new-job-form" onSubmit={handleCreateJob} className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  {/* Customer Name */}
                  <div style={{ gridColumn: "1 / 2" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Customer Name</label>
                    <input 
                      type="text" 
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="e.g. Riverside Resort" 
                      required
                      style={{
                        width: "100%",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--accent)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  {/* Phone Number */}
                  <div style={{ gridColumn: "2 / 3" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Phone Number</label>
                    <div style={{ position: "relative" }}>
                      <Phone size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)" }} />
                      <input 
                        type="tel" 
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Customer Phone" 
                        required
                        style={{
                          width: "100%",
                          background: "var(--surface-2)",
                          border: "1px solid var(--surface-border)",
                          color: "white",
                          padding: "0.75rem 1rem 0.75rem 2.5rem",
                          borderRadius: "8px",
                          outline: "none",
                          fontFamily: "inherit"
                        }}
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div style={{ gridColumn: "1 / 2" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Location</label>
                    <input 
                      type="text" 
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g. Zone A" 
                      required
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  {/* Scheduled Date */}
                  <div style={{ gridColumn: "2 / 3" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Scheduled Date</label>
                    <DatePicker
                      name="date"
                      value={formData.date}
                      onChange={(val) => setFormData((prev) => ({ ...prev, date: val }))}
                      required
                    />
                  </div>

                  {/* Number of Trees */}
                  <div style={{ gridColumn: "1 / 2" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      <TreePine size={16} color="var(--accent)" /> Number of Trees
                    </label>
                    <input 
                      type="number" 
                      name="trees"
                      min="1"
                      value={formData.trees}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  {/* Workers Required */}
                  <div style={{ gridColumn: "2 / 3" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      <Users size={16} color="var(--accent)" /> Workers Required
                    </label>
                    <input 
                      type="number" 
                      name="workersRequired"
                      min="1"
                      value={formData.workersRequired}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  {/* Price per Tree */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      <Briefcase size={16} color="var(--accent)" /> Price per Tree (₹)
                    </label>
                    <input 
                      list="price-presets"
                      name="pricePerTree"
                      value={formData.pricePerTree}
                      onChange={handleInputChange}
                      placeholder="Type a price or select a preset"
                      required
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                    <datalist id="price-presets">
                      <option value="40" />
                      <option value="50" />
                      <option value="60" />
                    </datalist>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: "1.5rem 2rem", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end", gap: "1rem", borderTop: "1px solid var(--surface-border)" }}>
                <button 
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: "0.6rem 1.2rem",
                    background: "transparent",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="new-job-form"
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.5rem",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? "Creating..." : "Create Job"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Job Modal */}
        {isEditModalOpen && editingJob && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: isEditModalClosing ? "rgba(0, 0, 0, 0)" : "rgba(0, 0, 0, 0.6)",
            backdropFilter: isEditModalClosing ? "blur(0px)" : "blur(4px)",
            transition: "all 0.4s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}>
            <div 
              className={`mobile-scroll-modal ${isEditModalClosing ? "modal-closing" : "modal-opening"}`}
              style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "550px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}>
              {/* Modal Header */}
              <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Edit size={24} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Edit Job Request</h2>
                </div>
                <button 
                  onClick={closeEditModal}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "2rem" }}>
                <p style={{ margin: "0 0 2rem 0", color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Update coconut harvesting task details for this customer.
                </p>

                <form id="edit-job-form" onSubmit={handleUpdateJob} className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  {/* Customer Name */}
                  <div style={{ gridColumn: "1 / 2" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Customer Name</label>
                    <input 
                      type="text" 
                      name="customerName"
                      value={editFormData.customerName}
                      onChange={handleEditInputChange}
                      placeholder="Customer Name" 
                      required
                      style={{
                        width: "100%",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--accent)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  {/* Phone Number */}
                  <div style={{ gridColumn: "2 / 3" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Phone Number</label>
                    <div style={{ position: "relative" }}>
                      <Phone size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)" }} />
                      <input 
                        type="tel" 
                        name="phone"
                        value={editFormData.phone}
                        onChange={handleEditInputChange}
                        placeholder="Customer Phone" 
                        required
                        style={{
                          width: "100%",
                          background: "var(--surface-2)",
                          border: "1px solid var(--surface-border)",
                          color: "white",
                          padding: "0.75rem 1rem 0.75rem 2.5rem",
                          borderRadius: "8px",
                          outline: "none",
                          fontFamily: "inherit"
                        }}
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div style={{ gridColumn: "1 / 2" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Location</label>
                    <input 
                      type="text" 
                      name="location"
                      value={editFormData.location}
                      onChange={handleEditInputChange}
                      placeholder="e.g. Zone A" 
                      required
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  {/* Scheduled Date */}
                  <div style={{ gridColumn: "2 / 3" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Scheduled Date</label>
                    <DatePicker
                      name="date"
                      value={editFormData.date}
                      onChange={(val) => setEditFormData((prev) => ({ ...prev, date: val }))}
                      required
                    />
                  </div>

                  {/* Number of Trees */}
                  <div style={{ gridColumn: "1 / 2" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      <TreePine size={16} color="var(--accent)" /> Number of Trees
                    </label>
                    <input 
                      type="number" 
                      name="trees"
                      min="1"
                      value={editFormData.trees}
                      onChange={handleEditInputChange}
                      required
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  {/* Workers Required */}
                  <div style={{ gridColumn: "2 / 3" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      <Users size={16} color="var(--accent)" /> Workers Required
                    </label>
                    <input 
                      type="number" 
                      name="workersRequired"
                      min="1"
                      value={editFormData.workersRequired}
                      onChange={handleEditInputChange}
                      required
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  {/* Price per Tree */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      <Briefcase size={16} color="var(--accent)" /> Price per Tree (₹)
                    </label>
                    <input 
                      list="edit-price-presets"
                      name="pricePerTree"
                      value={editFormData.pricePerTree}
                      onChange={handleEditInputChange}
                      placeholder="Type a price or select a preset"
                      required
                      style={{
                        width: "100%",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                    <datalist id="edit-price-presets">
                      <option value="40" />
                      <option value="50" />
                      <option value="60" />
                    </datalist>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: "1.5rem 2rem", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end", gap: "1rem", borderTop: "1px solid var(--surface-border)" }}>
                <button 
                  type="button"
                  onClick={closeEditModal}
                  style={{
                    padding: "0.6rem 1.2rem",
                    background: "transparent",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="edit-job-form"
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.5rem",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmJob && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: isDeleteModalClosing ? "rgba(0, 0, 0, 0)" : "rgba(0, 0, 0, 0.6)",
            backdropFilter: isDeleteModalClosing ? "blur(0px)" : "blur(4px)",
            transition: "all 0.4s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}>
            <div 
              className={`mobile-scroll-modal ${isDeleteModalClosing ? "modal-closing" : "modal-opening"}`}
              style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "450px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}>
              {/* Modal Body */}
              <div style={{ padding: "2.5rem 2rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1.5rem"
                }}>
                  <AlertTriangle size={30} color="rgb(239, 68, 68)" />
                </div>
                
                <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.25rem", fontWeight: 700 }}>Delete Job Request</h3>
                
                <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  Are you sure you want to delete the job request for <strong style={{ color: "white" }}>{deleteConfirmJob.customerName}</strong>? This action cannot be undone and will remove the task completely.
                </p>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: "1.25rem 2rem", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end", gap: "1rem", borderTop: "1px solid var(--surface-border)" }}>
                <button 
                  type="button"
                  onClick={closeDeleteModal}
                  style={{
                    padding: "0.6rem 1.2rem",
                    background: "transparent",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.5rem",
                    background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? "Deleting..." : "Delete Job"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Job Details Modal */}
        {confirmingJob && isConfirmModalOpen && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: isConfirmModalClosing ? "rgba(0, 0, 0, 0)" : "rgba(0, 0, 0, 0.6)",
            backdropFilter: isConfirmModalClosing ? "blur(0px)" : "blur(4px)",
            transition: "all 0.4s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}>
            <div 
              className={`mobile-scroll-modal ${isConfirmModalClosing ? "modal-closing" : "modal-opening"}`}
              style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}>
              {/* Modal Header */}
              <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Clock size={24} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "white" }}>Confirm Job Details</h2>
                </div>
                <button 
                  onClick={closeConfirmModal}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "2rem" }}>
                <p style={{ margin: "0 0 1.5rem 0", color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Finalize the start time and pricing structure for <strong style={{ color: "white" }}>{confirmingJob.customerName}</strong>.
                </p>

                <form id="confirm-job-form" onSubmit={handleConfirmJobSubmit}>
                  {/* Exact Start Time Input */}
                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      Exact Start Time
                    </label>
                    <div style={{ position: "relative" }}>
                      <Clock size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)" }} />
                      <input 
                        type="text"
                        placeholder="e.g. 6:15 AM or 17:30"
                        value={confirmStartTime}
                        onChange={(e) => setConfirmStartTime(e.target.value)}
                        style={{
                          width: "100%",
                          background: "var(--surface-2)",
                          border: "1px solid var(--surface-border)",
                          color: "white",
                          padding: "0.75rem 1rem 0.75rem 2.5rem",
                          borderRadius: "8px",
                          outline: "none",
                          fontFamily: "inherit"
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      ⚡ Quick Presets
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                      {["6:00 AM", "7:00 AM", "8:00 AM", "4:30 PM"].map((timePreset) => {
                        const isSelected = confirmStartTime === timePreset;
                        return (
                          <button
                            key={timePreset}
                            type="button"
                            onClick={() => setConfirmStartTime(timePreset)}
                            style={{
                              padding: "0.5rem 1rem",
                              borderRadius: "8px",
                              background: isSelected ? "rgba(123, 44, 191, 0.15)" : "var(--surface-2)",
                              border: isSelected ? "1px solid var(--accent)" : "1px solid var(--surface-border)",
                              color: isSelected ? "var(--accent)" : "rgba(255,255,255,0.7)",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                e.currentTarget.style.color = "white";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "var(--surface-2)";
                                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                              }
                            }}
                          >
                            {timePreset}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Confirm Price Input */}
                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      Confirm Price (₹/tree)
                    </label>
                    <div style={{ position: "relative" }}>
                      <Briefcase size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)" }} />
                      <input 
                        type="text"
                        placeholder="Type a price or select a preset below"
                        value={confirmSelectedPrice}
                        onChange={(e) => setConfirmSelectedPrice(e.target.value)}
                        style={{
                          width: "100%",
                          background: "var(--surface-2)",
                          border: "1px solid var(--surface-border)",
                          color: "white",
                          padding: "0.75rem 1rem 0.75rem 2.5rem",
                          borderRadius: "8px",
                          outline: "none",
                          fontFamily: "inherit"
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Price Presets */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      💸 Quick Price Presets
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                      {[
                        { label: "₹30", value: "Price (₹30/tree)" },
                        { label: "₹45", value: "Price (₹45/tree)" },
                        { label: "₹50", value: "Price (₹50/tree)" },
                        { label: "₹60", value: "Price (₹60/tree)" }
                      ].map((preset) => {
                        const isSelected = confirmSelectedPrice === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setConfirmSelectedPrice(preset.value)}
                            style={{
                              padding: "0.5rem 1rem",
                              borderRadius: "8px",
                              background: isSelected ? "rgba(123, 44, 191, 0.15)" : "var(--surface-2)",
                              border: isSelected ? "1px solid var(--accent)" : "1px solid var(--surface-border)",
                              color: isSelected ? "var(--accent)" : "rgba(255,255,255,0.7)",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                e.currentTarget.style.color = "white";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "var(--surface-2)";
                                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                              }
                            }}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scheduled For Row */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    background: "var(--surface-2)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    marginBottom: "0.5rem",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.7)"
                  }}>
                    <Calendar size={16} color="var(--accent)" />
                    <span>Scheduled for: <strong style={{ color: "white" }}>{confirmingJob.date}</strong></span>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: "1.5rem 2rem", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end", gap: "1rem", borderTop: "1px solid var(--surface-border)" }}>
                <button 
                  type="button"
                  onClick={closeConfirmModal}
                  style={{
                    padding: "0.6rem 1.2rem",
                    background: "transparent",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="confirm-job-form"
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.5rem",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? "Confirming..." : "Confirm Job"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Team Modal */}
        {assignTeamJobId && (
          <AssignTeamModal
            jobId={assignTeamJobId}
            workersRequired={assignTeamWorkersRequired}
            alreadyAssignedUids={assignTeamExcludeUids}
            onClose={() => setAssignTeamJobId(null)}
            onAssigned={() => {
              // If this was a reassignment, merge new workers with existing accepted ones
              if (assignTeamExcludeUids.length > 0) {
                const job = jobs.find(j => j.id === assignTeamJobId);
                if (job?.assignedWorkers) {
                  // The modal already wrote the new workers; we need to merge accepted ones back
                  const acceptedWorkers = job.assignedWorkers.filter(w => w.status === "accepted");
                  // Firestore was updated by the modal, but only with the new workers
                  // We need to merge, so update Firestore again
                  const jobRef = doc(db, "jobs", assignTeamJobId);
                  onSnapshot(doc(db, "jobs", assignTeamJobId), (snap) => {
                    if (snap.exists()) {
                      const newWorkers = snap.data().assignedWorkers || [];
                      const merged = [...acceptedWorkers, ...newWorkers];
                      updateDoc(jobRef, { assignedWorkers: merged });
                    }
                  });
                }
              }
              setAssignTeamJobId(null);
            }}
          />
        )}

        {/* Assign Delivery Modal */}
        {assignDeliveryJobId && (
          <AssignDeliveryModal
            jobId={assignDeliveryJobId}
            onClose={() => setAssignDeliveryJobId(null)}
            onAssigned={() => setAssignDeliveryJobId(null)}
          />
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
      </main>
    </div>
  );
}
