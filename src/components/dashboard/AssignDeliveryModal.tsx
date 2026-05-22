"use client";

import { useState, useEffect } from "react";
import { X, Truck, Search, Check, User } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";

interface DeliveryUser {
  uid: string;
  name: string;
  phone: string;
  email: string;
}

interface AssignDeliveryModalProps {
  jobId: string;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignDeliveryModal({
  jobId,
  onClose,
  onAssigned,
}: AssignDeliveryModalProps) {
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const fetchDeliveryBoys = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "delivery"));
        const snap = await getDocs(q);
        const list: DeliveryUser[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            uid: data.uid,
            name: data.name || "Unnamed Delivery Boy",
            phone: data.phone || "",
            email: data.email || "",
          });
        });
        setDeliveryBoys(list);
      } catch (err) {
        console.error("Error fetching delivery boys:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveryBoys();
  }, []);

  const handleAssign = async () => {
    if (!selectedUid) return;
    setSubmitting(true);
    try {
      const chosen = deliveryBoys.find((d) => d.uid === selectedUid)!;
      const jobRef = doc(db, "jobs", jobId);

      // Optimistic transition
      onAssigned();
      animateClose();

      // Background Firestore update
      updateDoc(jobRef, {
        assignedDelivery: {
          uid: chosen.uid,
          name: chosen.name,
          status: "pending",
        },
        status: "DELIVERY_PENDING",
      }).catch((err) => {
        console.error("Firestore error assigning delivery boy:", err);
        alert("Failed to save delivery assignment on server.");
      });
    } catch (err) {
      console.error("Error assigning delivery boy:", err);
      alert("Failed to assign delivery boy.");
    } finally {
      setSubmitting(false);
    }
  };

  const animateClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  };

  const filtered = deliveryBoys.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phone.includes(searchQuery)
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
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Truck size={20} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Assign Delivery</h2>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-light)" }}>
                Select a delivery boy for this job
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

        {/* Delivery Boy list */}
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
              {deliveryBoys.length === 0
                ? "No registered delivery boys found."
                : "No delivery boys match your search."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {filtered.map((d) => {
                const isSelected = selectedUid === d.uid;
                return (
                  <button
                    key={d.uid}
                    type="button"
                    onClick={() => setSelectedUid(isSelected ? null : d.uid)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      width: "100%",
                      padding: "0.85rem 1rem",
                      borderRadius: "12px",
                      background: isSelected
                        ? "rgba(59,130,246,0.1)"
                        : "var(--surface-2)",
                      border: isSelected
                        ? "1.5px solid rgba(59,130,246,0.5)"
                        : "1.5px solid var(--surface-border)",
                      color: "var(--foreground)",
                      cursor: "pointer",
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
                          ? "linear-gradient(135deg, #3b82f6, #2563eb)"
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
                        {d.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-light)",
                          marginTop: "2px",
                        }}
                      >
                        {d.phone || d.email}
                      </div>
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
            disabled={submitting || !selectedUid}
            style={{
              padding: "0.65rem 1.5rem",
              background: selectedUid
                ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                : "var(--surface-2)",
              color: selectedUid ? "white" : "var(--text-light)",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              cursor: selectedUid ? "pointer" : "not-allowed",
              opacity: submitting ? 0.7 : 1,
              fontFamily: "inherit",
              fontSize: "0.9rem",
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
            }}
          >
            {submitting ? "Assigning..." : "Assign Delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}
