"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { 
  ClipboardList, Plus, X, Edit, Trash2, 
  Users, Briefcase, IndianRupee, Award, 
  TrendingUp, HelpCircle, User, Info, CheckCircle
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

interface SalaryPlan {
  id: string;
  name: string;
  baseCount: number;
  baseSalary: number;
  pushCount: number;
  incentive: number;
  createdAt?: string;
}

interface Worker {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  planId?: string | null;
}

export default function ManagerPlans() {
  const router = useRouter();
  const [currentUserName, setCurrentUserName] = useState("Manager");
  const [currentUserRole, setCurrentUserRole] = useState("manager");
  const [plans, setPlans] = useState<SalaryPlan[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activeTab, setActiveTab] = useState<"plans" | "assignments">("plans");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SalaryPlan | null>(null);

  // Confirmation state
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isAlertOnly?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    baseCount: 500,
    baseSalary: 10000,
    pushCount: 600,
    incentive: 5
  });

  const [editFormData, setEditFormData] = useState({
    id: "",
    name: "",
    baseCount: 500,
    baseSalary: 10000,
    pushCount: 600,
    incentive: 5
  });

  // Listen to plans and workers
  useEffect(() => {
    const unsubPlans = onSnapshot(collection(db, "plans"), (snapshot) => {
      const plansList: SalaryPlan[] = [];
      snapshot.forEach((d) => {
        plansList.push({ id: d.id, ...d.data() } as SalaryPlan);
      });
      // Sort by name
      plansList.sort((a, b) => a.name.localeCompare(b.name));
      setPlans(plansList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to plans:", error);
      setLoading(false);
    });

    const unsubWorkers = onSnapshot(collection(db, "users"), (snapshot) => {
      const workersList: Worker[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Worker;
        if (data.role === "worker") {
          workersList.push({ ...data, uid: d.id });
        }
      });
      workersList.sort((a, b) => a.name.localeCompare(b.name));
      setWorkers(workersList);
    }, (error) => {
      console.error("Error listening to workers:", error);
    });

    return () => {
      unsubPlans();
      unsubWorkers();
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: name === "name" ? value : Number(value) 
    }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ 
      ...prev, 
      [name]: name === "name" ? value : Number(value) 
    }));
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (formData.pushCount <= formData.baseCount) {
      setConfirmConfig({
        title: "Validation Error",
        message: "Push target count must be strictly greater than base count.",
        isAlertOnly: true,
        onConfirm: () => {}
      });
      return;
    }

    const oldPlans = [...plans];
    const newPlanTemp = {
      id: `temp-${Date.now()}`,
      ...formData,
      createdAt: new Date().toISOString()
    };

    // Optimistic Update
    setPlans((prev) => [...prev, newPlanTemp].sort((a, b) => a.name.localeCompare(b.name)));
    
    // Close Modal instantly
    setIsAddModalOpen(false);
    setFormData({
      name: "",
      baseCount: 500,
      baseSalary: 10000,
      pushCount: 600,
      incentive: 5
    });

    try {
      await addDoc(collection(db, "plans"), {
        name: newPlanTemp.name,
        baseCount: newPlanTemp.baseCount,
        baseSalary: newPlanTemp.baseSalary,
        pushCount: newPlanTemp.pushCount,
        incentive: newPlanTemp.incentive,
        createdAt: newPlanTemp.createdAt
      });
    } catch (error) {
      console.error("Error creating plan:", error);
      setConfirmConfig({
        title: "Creation Error",
        message: "Failed to create plan.",
        isAlertOnly: true,
        onConfirm: () => {}
      });
      setPlans(oldPlans);
    }
  };

  const handleEditClick = (plan: SalaryPlan) => {
    setSelectedPlan(plan);
    setEditFormData({
      id: plan.id,
      name: plan.name,
      baseCount: plan.baseCount,
      baseSalary: plan.baseSalary,
      pushCount: plan.pushCount,
      incentive: plan.incentive
    });
    setIsEditModalOpen(true);
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editFormData.pushCount <= editFormData.baseCount) {
      setConfirmConfig({
        title: "Validation Error",
        message: "Push target count must be strictly greater than base count.",
        isAlertOnly: true,
        onConfirm: () => {}
      });
      return;
    }

    const oldPlans = [...plans];
    const { id, ...updatedFields } = editFormData;

    // Optimistic Update
    setPlans((prev) =>
      prev
        .map((plan) => (plan.id === id ? ({ ...plan, ...updatedFields } as SalaryPlan) : plan))
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    // Close Modal instantly
    setIsEditModalOpen(false);
    setSelectedPlan(null);

    try {
      const planRef = doc(db, "plans", id);
      await updateDoc(planRef, updatedFields);
    } catch (error) {
      console.error("Error updating plan:", error);
      setConfirmConfig({
        title: "Update Error",
        message: "Failed to update plan.",
        isAlertOnly: true,
        onConfirm: () => {}
      });
      setPlans(oldPlans);
    }
  };

  const handleDeletePlan = async (plan: SalaryPlan) => {
    setConfirmConfig({
      title: "Delete Salary Plan",
      message: `Are you sure you want to delete the salary plan "${plan.name}"? Any assigned workers will be unassigned.`,
      confirmLabel: "Delete Plan",
      onConfirm: async () => {
        setConfirmConfig(null);
        
        const oldPlans = [...plans];
        const oldWorkers = [...workers];

        // Optimistic Update: remove plan and unassign workers in local state
        setPlans((prev) => prev.filter((p) => p.id !== plan.id));
        setWorkers((prev) =>
          prev.map((w) => (w.planId === plan.id ? { ...w, planId: null } : w))
        );

        try {
          await deleteDoc(doc(db, "plans", plan.id));
          const assignedWorkers = oldWorkers.filter(w => w.planId === plan.id);
          for (const worker of assignedWorkers) {
            await updateDoc(doc(db, "users", worker.uid), { planId: null });
          }
        } catch (error) {
          console.error("Error deleting plan:", error);
          setConfirmConfig({
            title: "Deletion Error",
            message: "Failed to delete plan.",
            isAlertOnly: true,
            onConfirm: () => {}
          });
          setPlans(oldPlans);
          setWorkers(oldWorkers);
        }
      }
    });
  };

  const handleAssignPlan = async (workerUid: string, planId: string | null) => {
    const oldWorkers = [...workers];

    // Optimistic Update
    setWorkers((prev) =>
      prev.map((w) => (w.uid === workerUid ? { ...w, planId: planId } : w))
    );

    try {
      await updateDoc(doc(db, "users", workerUid), {
        planId: planId || null
      });
    } catch (error) {
      console.error("Error assigning plan:", error);
      setConfirmConfig({
        title: "Assignment Error",
        message: "Failed to update assignment.",
        isAlertOnly: true,
        onConfirm: () => {}
      });
      setWorkers(oldWorkers);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      {/* Sidebar */}
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        <TopBar title="Salary Plans & Packages" />

        <div style={{ padding: "2.5rem", flex: 1, maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
          
          {/* Header Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            {/* Tabs */}
            <div style={{
              display: "inline-flex",
              background: "var(--surface-1)",
              border: "1px solid var(--surface-border)",
              padding: "0.25rem",
              borderRadius: "10px",
              backdropFilter: "blur(8px)"
            }}>
              <button 
                onClick={() => setActiveTab("plans")}
                style={{
                  padding: "0.6rem 1.5rem",
                  background: activeTab === "plans" ? "var(--primary-glow)" : "transparent",
                  color: activeTab === "plans" ? "var(--primary-hover)" : "var(--text-muted)",
                  border: `1px solid ${activeTab === "plans" ? "var(--primary-glow-border)" : "transparent"}`,
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <ClipboardList size={16} />
                  Manage Plans
                </div>
              </button>
              <button 
                onClick={() => setActiveTab("assignments")}
                style={{
                  padding: "0.6rem 1.5rem",
                  background: activeTab === "assignments" ? "var(--primary-glow)" : "transparent",
                  color: activeTab === "assignments" ? "var(--primary-hover)" : "var(--text-muted)",
                  border: `1px solid ${activeTab === "assignments" ? "var(--primary-glow-border)" : "transparent"}`,
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Users size={16} />
                  Worker Assignments
                </div>
              </button>
            </div>

            {/* Action button (Only in Manage Plans tab) */}
            {activeTab === "plans" && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.5rem",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px var(--primary-glow-border)",
                  transition: "opacity 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                <Plus size={16} />
                Create Plan
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }} />
            </div>
          ) : activeTab === "plans" ? (
            /* Manage Plans Tab Content */
            plans.length === 0 ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "350px",
                background: "rgba(13, 6, 40, 0.5)",
                backdropFilter: "blur(12px)",
                borderRadius: "16px",
                border: "1px dashed var(--surface-border)",
                color: "rgba(255,255,255,0.5)",
                gap: "1rem"
              }}>
                <ClipboardList size={48} strokeWidth={1} style={{ color: "rgba(255,255,255,0.3)" }} />
                <p style={{ margin: 0 }}>No salary plans defined yet. Click 'Create Plan' to get started.</p>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1.5rem"
              }}>
                {plans.map((plan) => {
                  const assignedCount = workers.filter(w => w.planId === plan.id).length;
                  return (
                    <div 
                      key={plan.id}
                      className="plan-card"
                      style={{
                        padding: "1.75rem",
                        borderRadius: "16px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--surface-border)",
                        position: "relative",
                        overflow: "hidden"
                      }}
                    >
                      {/* Card Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                        <div>
                          <h4 style={{ fontSize: "1.35rem", margin: "0 0 0.25rem 0", fontWeight: 700, color: "white" }}>
                            {plan.name}
                          </h4>
                          <span style={{ fontSize: "0.8rem", color: "var(--accent)", fontWeight: 600 }}>
                            {assignedCount} {assignedCount === 1 ? "worker" : "workers"} assigned
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={() => handleEditClick(plan)}
                            className="card-action-btn"
                            style={{ background: "rgba(255,255,255,0.03)" }}
                            title="Edit Plan"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan)}
                            className="card-action-btn"
                            style={{ background: "rgba(239,35,60,0.08)", color: "var(--error)" }}
                            title="Delete Plan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Package Breakdown Grid */}
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "1fr 1fr", 
                        gap: "1rem", 
                        background: "rgba(0,0,0,0.2)",
                        padding: "1rem",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.03)",
                        marginBottom: "1.5rem"
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Base Count</span>
                          <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "white", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <TrendingUp size={16} color="var(--accent)" />
                            {plan.baseCount} trees
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Base Salary</span>
                          <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#06d6a0", display: "flex", alignItems: "center", gap: "0.1rem" }}>
                            ₹{plan.baseSalary.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Push Target</span>
                          <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "white", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <Award size={16} color="var(--primary-hover)" />
                            {plan.pushCount} trees
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Incentive / Tree</span>
                          <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)", display: "flex", alignItems: "center", gap: "0.1rem" }}>
                            ₹{plan.incentive}
                          </span>
                        </div>
                      </div>

                      {/* Tier Logic Explanation Card */}
                      <div style={{ 
                        background: "var(--primary-glow)",
                        border: "1px dashed var(--primary-glow-border)",
                        padding: "1rem",
                        borderRadius: "10px",
                        fontSize: "0.82rem",
                        lineHeight: 1.5,
                        color: "rgba(255,255,255,0.75)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "var(--primary-hover)", marginBottom: "0.4rem" }}>
                          <Info size={14} />
                          Tier Rules Overview
                        </div>
                        <ul style={{ paddingLeft: "1.2rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <li><strong>Under {plan.baseCount} trees:</strong> Prorated salary up to ₹{plan.baseSalary.toLocaleString()} (no bonus).</li>
                          <li><strong>{plan.baseCount} to {plan.pushCount - 1} trees:</strong> ₹{plan.baseSalary.toLocaleString()} + ₹{plan.incentive}/tree above base.</li>
                          <li><strong>{plan.pushCount}+ trees (Push Mode):</strong> ₹{plan.baseSalary.toLocaleString()} + ₹{(plan.pushCount * plan.incentive).toLocaleString()} push bonus + ₹{plan.incentive}/tree for extra trees above {plan.pushCount}.</li>
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Worker Assignments Tab Content */
            <div style={{
              background: "var(--surface)",
              borderRadius: "16px",
              border: "1px solid var(--surface-border)",
              overflow: "hidden"
            }}>
              {workers.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                  No workers found. Create user profiles with role 'worker' first.
                </div>
              ) : (
                <div className="scroll-table-container">
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(0,0,0,0.2)" }}>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Worker Info</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Contact</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Active Salary Package</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Change Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((worker) => {
                      const activePlan = plans.find(p => p.id === worker.planId);
                      return (
                        <tr key={worker.uid} className="worker-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "1rem 1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              <div style={{
                                width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.03)",
                                display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--surface-border)"
                              }}>
                                <User size={16} color="rgba(255,255,255,0.6)" />
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: "white" }}>{worker.name}</div>
                                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Worker ID: {worker.uid.slice(0, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "1rem 1.5rem" }}>
                            <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>{worker.email}</div>
                            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "0.2rem" }}>{worker.phone}</div>
                          </td>
                          <td style={{ padding: "1rem 1.5rem" }}>
                            {activePlan ? (
                              <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                background: "rgba(16,185,129,0.08)",
                                border: "1px solid rgba(16,185,129,0.25)",
                                color: "#10b981",
                                padding: "0.3rem 0.75rem",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                fontWeight: 600
                              }}>
                                <CheckCircle size={12} />
                                {activePlan.name} (Base count: {activePlan.baseCount})
                              </div>
                            ) : (
                              <span style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                color: "rgba(255,255,255,0.4)",
                                padding: "0.3rem 0.75rem",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                fontWeight: 500
                              }}>
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                            <select
                              value={worker.planId || ""}
                              onChange={(e) => handleAssignPlan(worker.uid, e.target.value || null)}
                              style={{
                                background: "var(--surface-2)",
                                border: "1px solid var(--surface-border)",
                                color: "white",
                                padding: "0.5rem 1rem",
                                borderRadius: "8px",
                                outline: "none",
                                fontSize: "0.85rem",
                                fontWeight: 550,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                width: "200px"
                              }}
                            >
                              <option value="" style={{ backgroundColor: "#121218", color: "white" }}>Unassign / No Plan</option>
                              {plans.map((p) => (
                                <option key={p.id} value={p.id} style={{ backgroundColor: "#121218", color: "white" }}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}
        </div>

        {/* Create Plan Modal */}
        {isAddModalOpen && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}>
            <div className="modal-opening mobile-scroll-modal" style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}>
              {/* Modal Header */}
              <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <ClipboardList size={22} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Create Salary Plan</h2>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreatePlan}>
                <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  {/* Plan Name */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Plan Name</label>
                    <input 
                      type="text" 
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g. Premium Harvest Plan" 
                      required
                      style={{
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                    {/* Base Count */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Base Count (Trees)</label>
                      <input 
                        type="number" 
                        name="baseCount"
                        min="1"
                        value={formData.baseCount}
                        onChange={handleInputChange}
                        required
                        style={{
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

                    {/* Base Salary */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Base Salary (₹)</label>
                      <input 
                        type="number" 
                        name="baseSalary"
                        min="0"
                        value={formData.baseSalary}
                        onChange={handleInputChange}
                        required
                        style={{
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

                    {/* Push Target Count */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Push Target Count</label>
                      <input 
                        type="number" 
                        name="pushCount"
                        min="1"
                        value={formData.pushCount}
                        onChange={handleInputChange}
                        required
                        style={{
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

                    {/* Incentive Per Tree */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Incentive (₹ / tree)</label>
                      <input 
                        type="number" 
                        name="incentive"
                        min="0"
                        value={formData.incentive}
                        onChange={handleInputChange}
                        required
                        style={{
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
                  </div>

                </div>

                {/* Modal Footer */}
                <div style={{ padding: "1.5rem 2rem", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end", gap: "1rem", borderTop: "1px solid var(--surface-border)" }}>
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
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
                    {submitting ? "Creating..." : "Create Plan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Plan Modal */}
        {isEditModalOpen && selectedPlan && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}>
            <div className="modal-opening mobile-scroll-modal" style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}>
              {/* Modal Header */}
              <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Edit size={22} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Edit Salary Plan</h2>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleUpdatePlan}>
                <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  {/* Plan Name */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Plan Name</label>
                    <input 
                      type="text" 
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditInputChange}
                      placeholder="Plan Name" 
                      required
                      style={{
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--surface-border)",
                        color: "white",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>

                  <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                    {/* Base Count */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Base Count (Trees)</label>
                      <input 
                        type="number" 
                        name="baseCount"
                        min="1"
                        value={editFormData.baseCount}
                        onChange={handleEditInputChange}
                        required
                        style={{
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

                    {/* Base Salary */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Base Salary (₹)</label>
                      <input 
                        type="number" 
                        name="baseSalary"
                        min="0"
                        value={editFormData.baseSalary}
                        onChange={handleEditInputChange}
                        required
                        style={{
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

                    {/* Push Target Count */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Push Target Count</label>
                      <input 
                        type="number" 
                        name="pushCount"
                        min="1"
                        value={editFormData.pushCount}
                        onChange={handleEditInputChange}
                        required
                        style={{
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

                    {/* Incentive Per Tree */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Incentive (₹ / tree)</label>
                      <input 
                        type="number" 
                        name="incentive"
                        min="0"
                        value={editFormData.incentive}
                        onChange={handleEditInputChange}
                        required
                        style={{
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
                  </div>

                </div>

                {/* Modal Footer */}
                <div style={{ padding: "1.5rem 2rem", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end", gap: "1rem", borderTop: "1px solid var(--surface-border)" }}>
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
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
              </form>
            </div>
          </div>
        )}

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
            <div className="modal-opening" style={{
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
        .plan-card {
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
                      box-shadow 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
                      border-color 0.3s ease;
        }
        .plan-card:hover {
          transform: translateY(-6px) scale(1.01);
          border-color: var(--accent) !important;
          box-shadow: 0 20px 40px -15px var(--primary-glow-border), 
                      0 0 30px -5px var(--accent-glow);
        }
        .card-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--surface-border);
          color: rgba(255,255,255,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .card-action-btn:hover {
          color: white;
          border-color: var(--accent);
          transform: scale(1.08);
        }
        .worker-row {
          transition: background-color 0.2s;
        }
        .worker-row:hover {
          background-color: rgba(255,255,255,0.02) !important;
        }
        select option {
          background-color: #121218 !important;
          color: white !important;
        }
      `}} />
    </div>
  );
}
