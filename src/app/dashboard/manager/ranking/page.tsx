"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { Trophy, Edit2, Check, X, RefreshCw, Star, User, Mail, Phone, Calendar } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/context/ToastContext";

interface Worker {
  uid: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  rankingPoints?: number;
}

export default function WorkerRankings() {
  const { showToast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState<number>(0);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("manager");
  const [currentUserName, setCurrentUserName] = useState<string>("Manager");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCurrentUserRole(data.role || "worker");
            setCurrentUserName(data.name || "User");
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      }
    });

    const q = query(collection(db, "users"), where("role", "==", "worker"));
    const unsubSnapshot = onSnapshot(q, (snapshot) => {
      const list: Worker[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Worker;
        list.push({ ...data, uid: doc.id, rankingPoints: data.rankingPoints ?? 0 });
      });
      // Sort descending by rankingPoints
      list.sort((a, b) => (b.rankingPoints ?? 0) - (a.rankingPoints ?? 0));
      setWorkers(list);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to workers:", error);
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubSnapshot();
    };
  }, []);

  const handleStartEdit = (worker: Worker) => {
    setEditingUid(worker.uid);
    setEditPoints(worker.rankingPoints ?? 0);
  };

  const handleCancelEdit = () => {
    setEditingUid(null);
  };

  const handleSaveEdit = async (uid: string) => {
    setUpdatingUid(uid);
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        rankingPoints: editPoints,
      });
      setEditingUid(null);
      showToast("Ranking points updated successfully.", "success");
    } catch (err) {
      console.error("Error updating ranking points:", err);
      showToast("Failed to update points. Please try again.", "error");
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleResetAll = async () => {
    if (workers.length === 0) return;
    if (window.confirm("⚠️ WARNING: Are you sure you want to reset ALL worker rankings to zero? This action cannot be undone.")) {
      setResetting(true);
      try {
        const batch = writeBatch(db);
        workers.forEach((w) => {
          const userRef = doc(db, "users", w.uid);
          batch.update(userRef, { rankingPoints: 0 });
        });
        await batch.commit();
        showToast("Rankings reset successfully.", "success");
      } catch (err) {
        console.error("Error resetting rankings:", err);
        showToast("Failed to reset rankings.", "error");
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      {/* Sidebar */}
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Worker Rankings" />

        <div style={{ padding: "2rem", flex: 1, maxWidth: "1000px", width: "100%", margin: "0 auto" }}>
          
          {/* Header Row */}
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div>
              <h3 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 700 }}>Performance Rankings</h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--text-light)" }}>
                Workers are rewarded with +10 pts on acceptance, and penalized with -10 pts on rejection.
              </p>
            </div>
            {currentUserRole.toLowerCase() === "manager" && (
              <button
                onClick={handleResetAll}
                disabled={resetting || loading || workers.length === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.6rem 1.2rem",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                  color: "white",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity: resetting || workers.length === 0 ? 0.6 : 1,
                  transition: "opacity 0.2s",
                  boxShadow: "0 4px 12px rgba(239, 35, 60, 0.2)",
                }}
              >
                <RefreshCw size={16} className={resetting ? "spin-icon" : ""} />
                {resetting ? "Resetting..." : "Reset All to Zero"}
              </button>
            )}
          </div>

          {/* Table Area */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }}></div>
            </div>
          ) : workers.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "300px", background: "var(--surface)", border: "1px dashed var(--surface-border)",
              borderRadius: "16px", color: "var(--text-dim)", gap: "1rem"
            }}>
              <Trophy size={40} strokeWidth={1.5} />
              <div style={{ fontWeight: 600 }}>No Harvesting Workers Found</div>
            </div>
          ) : (
            <div style={{
              background: "var(--surface)",
              borderRadius: "16px",
              border: "1px solid var(--surface-border)",
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
            }}>
              <div className="scroll-table-container">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--surface-border)" }}>
                    <th style={thStyle}>Rank</th>
                    <th style={thStyle}>Worker Details</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Ranking Points</th>
                    {currentUserRole.toLowerCase() === "manager" && (
                      <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {workers.map((worker, index) => {
                    const isEditing = editingUid === worker.uid;
                    const isUpdating = updatingUid === worker.uid;
                    const points = worker.rankingPoints ?? 0;
                    
                    // Style medals for top 3
                    const isTop3 = index < 3;
                    const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
                    const medalBg = isTop3 ? medalColors[index] : "var(--surface-2)";

                    return (
                      <tr key={worker.uid} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} className="hover-row">
                        {/* Rank Badge */}
                        <td style={tdStyle}>
                          <div style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            background: medalBg,
                            color: isTop3 ? "#000" : "var(--foreground)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "0.85rem"
                          }}>
                            {index + 1}
                          </div>
                        </td>

                        {/* Name & Contact */}
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{worker.name}</div>
                          <div style={{ display: "flex", gap: "1rem", marginTop: "0.3rem", fontSize: "0.78rem", color: "var(--text-light)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <Mail size={12} />
                              {worker.email}
                            </span>
                            {worker.phone ? (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <Phone size={12} />
                                {worker.phone}
                              </span>
                            ) : null}
                            {worker.dob ? (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <Calendar size={12} />
                                {worker.dob}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Points Indicator */}
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {isEditing ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                              <input
                                type="number"
                                value={editPoints}
                                onChange={(e) => setEditPoints(parseInt(e.target.value) || 0)}
                                style={{
                                  width: "70px",
                                  background: "rgba(0,0,0,0.3)",
                                  border: "1px solid var(--accent)",
                                  borderRadius: "6px",
                                  color: "white",
                                  padding: "0.3rem 0.5rem",
                                  fontSize: "0.9rem",
                                  textAlign: "center",
                                  outline: "none",
                                  fontFamily: "inherit",
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{
                              display: "inline-flex", alignItems: "center", gap: "0.3rem",
                              padding: "0.3rem 0.6rem", borderRadius: "8px",
                              background: points >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,35,60,0.1)",
                              border: points >= 0 ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(239,35,60,0.2)",
                              color: points >= 0 ? "var(--accent)" : "#ef4444",
                              fontWeight: 700, fontSize: "0.85rem"
                            }}>
                              <Star size={12} />
                              {points}
                            </div>
                          )}
                        </td>

                        {/* Actions buttons */}
                        {currentUserRole.toLowerCase() === "manager" && (
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {isEditing ? (
                              <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                                <button
                                  onClick={() => handleSaveEdit(worker.uid)}
                                  disabled={isUpdating}
                                  style={{
                                    background: "rgba(16,185,129,0.2)",
                                    border: "none",
                                    color: "#10b981",
                                    cursor: "pointer",
                                    padding: "0.45rem",
                                    borderRadius: "6px",
                                  }}
                                  title="Save Points"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={isUpdating}
                                  style={{
                                    background: "rgba(239,35,60,0.2)",
                                    border: "none",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    padding: "0.45rem",
                                    borderRadius: "6px",
                                  }}
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEdit(worker)}
                                style={{
                                  background: "var(--surface-2)",
                                  border: "1px solid var(--surface-border)",
                                  color: "var(--foreground)",
                                  cursor: "pointer",
                                  padding: "0.45rem 0.8rem",
                                  borderRadius: "8px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  transition: "all 0.2s"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "var(--surface-overlay)";
                                  e.currentTarget.style.borderColor = "var(--primary)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "var(--surface-2)";
                                  e.currentTarget.style.borderColor = "var(--surface-border)";
                                }}
                                title="Edit Points"
                              >
                                <Edit2 size={12} />
                                Edit
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .hover-row:hover {
          background: rgba(255,255,255,0.02) !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
      `}} />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
  textAlign: "left",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  textTransform: "uppercase"
};

const tdStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
  verticalAlign: "middle"
};
