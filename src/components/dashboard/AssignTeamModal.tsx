"use client";

import { useState, useEffect } from "react";
import { X, Users, Search, Check, User } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/context/ToastContext";

interface WorkerUser {
  uid: string;
  name: string;
  phone: string;
  email: string;
  rankingPoints?: number;
}

interface AssignTeamModalProps {
  jobId: string;
  workersRequired: number;
  /** UIDs already assigned (for reassignment — exclude these from the list) */
  alreadyAssignedUids?: string[];
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignTeamModal({
  jobId,
  workersRequired,
  alreadyAssignedUids = [],
  onClose,
  onAssigned,
}: AssignTeamModalProps) {
  const { showToast } = useToast();
  const [workers, setWorkers] = useState<WorkerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "worker"));
        const snap = await getDocs(q);
        const list: WorkerUser[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const workerUid = data.uid || d.id;
          // Don't show workers that are already assigned to this job
          if (!alreadyAssignedUids.includes(workerUid)) {
            list.push({
              uid: workerUid,
              name: data.name || "Unnamed Worker",
              phone: data.phone || "",
              email: data.email || "",
              rankingPoints: data.rankingPoints ?? 0,
            });
          }
        });
        // Sort workers descending by rankingPoints
        list.sort((a, b) => (b.rankingPoints ?? 0) - (a.rankingPoints ?? 0));
        setWorkers(list);
      } catch (err) {
        console.error("Error fetching workers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkers();
  }, [alreadyAssignedUids]);

  const toggleWorker = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        if (next.size < workersRequired) {
          next.add(uid);
        }
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedUids.size === 0) return;
    setSubmitting(true);
    try {
      const selectedWorkers = workers
        .filter((w) => selectedUids.has(w.uid))
        .map((w) => ({
          uid: w.uid,
          name: w.name,
          status: "pending" as const,
        }));

      const jobRef = doc(db, "jobs", jobId);
      
      // Optimistic transition
      onAssigned();
      animateClose();

      // Background Firestore update
      updateDoc(jobRef, {
        assignedWorkers: selectedWorkers,
        status: "TEAM_PENDING",
      }).then(() => {
        showToast("Workers assigned successfully.", "success");
      }).catch((err) => {
        console.error("Firestore error assigning workers:", err);
        showToast("Failed to save worker assignment on server.", "error");
      });
    } catch (err) {
      console.error("Error assigning workers:", err);
      showToast("Failed to assign workers.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const animateClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  };

  const filtered = workers.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.phone.includes(searchQuery)
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: isClosing ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.6)",
        backdropFilter: isClosing ? "blur(0px)" : "blur(4px)",
        transition: "all 0.4s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) animateClose();
      }}
    >
      <div
        className={isClosing ? "modal-closing" : "modal-opening"}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--surface-border)",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "80vh",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem 2rem",
            borderBottom: "1px solid var(--surface-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={20} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Assign Team</h2>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-light)" }}>
                Select {workersRequired} worker{workersRequired > 1 ? "s" : ""} · {selectedUids.size}/{workersRequired} chosen
              </p>
            </div>
          </div>
          <button
            onClick={animateClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-light)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "1rem 2rem 0.75rem", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-light)",
              }}
            />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                background: "var(--surface-2)",
                border: "1px solid var(--surface-border)",
                color: "var(--foreground)",
                padding: "0.65rem 1rem 0.65rem 2.5rem",
                borderRadius: "10px",
                outline: "none",
                fontFamily: "inherit",
                fontSize: "0.88rem",
              }}
            />
          </div>
        </div>

        {/* Worker list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.5rem 2rem 1rem",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
              <div
                className="spinner"
                style={{ width: "32px", height: "32px", borderWidth: "3px" }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 0",
                color: "var(--text-light)",
                fontSize: "0.9rem",
              }}
            >
              {workers.length === 0 ? "No registered workers found." : "No workers match your search."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {filtered.map((w) => {
                const isSelected = selectedUids.has(w.uid);
                const isDisabled = !isSelected && selectedUids.size >= workersRequired;
                return (
                  <button
                    key={w.uid}
                    type="button"
                    onClick={() => !isDisabled && toggleWorker(w.uid)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      width: "100%",
                      padding: "0.85rem 1rem",
                      borderRadius: "12px",
                      background: isSelected
                        ? "rgba(16,185,129,0.1)"
                        : "var(--surface-2)",
                      border: isSelected
                        ? "1.5px solid rgba(16,185,129,0.5)"
                        : "1.5px solid var(--surface-border)",
                      color: "var(--foreground)",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      opacity: isDisabled ? 0.4 : 1,
                      transition: "all 0.2s ease",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "50%",
                        background: isSelected
                          ? "linear-gradient(135deg, #10b981, #059669)"
                          : "var(--surface-2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isSelected ? (
                        <Check size={18} color="white" />
                      ) : (
                        <User size={18} color="var(--text-light)" />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.92rem",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {w.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-light)",
                          marginTop: "2px",
                        }}
                      >
                        {w.phone || w.email}
                      </div>
                    </div>

                    {/* Points Badge */}
                    <div
                      style={{
                        padding: "0.25rem 0.6rem",
                        borderRadius: "8px",
                        background: "var(--surface-1)",
                        border: "1px solid var(--surface-border)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: (w.rankingPoints ?? 0) >= 0 ? "var(--accent)" : "#ef4444",
                        flexShrink: 0,
                      }}
                    >
                      ★ {(w.rankingPoints ?? 0)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "1.25rem 2rem",
            background: "var(--surface-2)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "1rem",
            borderTop: "1px solid var(--surface-border)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={animateClose}
            style={{
              padding: "0.6rem 1.2rem",
              background: "transparent",
              color: "var(--foreground)",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting || selectedUids.size === 0}
            style={{
              padding: "0.65rem 1.5rem",
              background:
                selectedUids.size > 0
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "var(--surface-2)",
              color: selectedUids.size > 0 ? "white" : "var(--text-light)",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              cursor: selectedUids.size > 0 ? "pointer" : "not-allowed",
              opacity: submitting ? 0.7 : 1,
              fontFamily: "inherit",
              fontSize: "0.9rem",
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
            }}
          >
            {submitting
              ? "Assigning..."
              : `Assign ${selectedUids.size} Worker${selectedUids.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
