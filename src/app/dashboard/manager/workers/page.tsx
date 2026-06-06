"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { Activity, Truck, Trash2, Calendar, MapPin, Edit2, X } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import { parseCoordinates } from "@/lib/locationUtils";

interface Worker {
  uid: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  role: string;
  createdAt?: string;
  stayLocation?: {
    address: string;
    latitude: number;
    longitude: number;
    rawUrl?: string;
  };
}

export default function WorkersDirectory() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const router = useRouter();
  const [currentUserName, setCurrentUserName] = useState("Manager");
  const [currentUserRole, setCurrentUserRole] = useState("manager");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  // Stay location editing states
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [stayAddress, setStayAddress] = useState("");
  const [stayCoordsInput, setStayCoordsInput] = useState("");
  const [savingStay, setSavingStay] = useState(false);

  const handleOpenEditStay = (worker: Worker) => {
    setEditingWorker(worker);
    setStayAddress(worker.stayLocation?.address || "");
    setStayCoordsInput(
      worker.stayLocation?.latitude
        ? `${worker.stayLocation.latitude}, ${worker.stayLocation.longitude}`
        : ""
    );
  };

  const handleSaveStay = async () => {
    if (!editingWorker) return;
    if (!stayAddress.trim()) {
      showToast("Please enter a stay address/room description.", "warning");
      return;
    }
    if (!stayCoordsInput.trim()) {
      showToast("Please enter coordinates or a Maps link.", "warning");
      return;
    }

    let parsed = parseCoordinates(stayCoordsInput);

    setSavingStay(true);

    if (!parsed) {
      if (stayCoordsInput.trim().startsWith("http")) {
        try {
          const res = await fetch("/api/resolve-coordinates", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: stayCoordsInput.trim() }),
          });
          if (res.ok) {
            parsed = await res.json();
          } else {
            const errData = await res.json();
            showToast(errData.error || "Failed to resolve Maps URL.", "error");
            setSavingStay(false);
            return;
          }
        } catch (err) {
          console.error("Error resolving Maps link:", err);
          showToast("Network error trying to resolve Maps link.", "error");
          setSavingStay(false);
          return;
        }
      } else {
        showToast("Could not parse coordinates. Format: lat,lng or Google Maps link.", "error");
        setSavingStay(false);
        return;
      }
    }

    if (!parsed) {
      showToast("Could not parse coordinates. Format: lat,lng or Google Maps link.", "error");
      setSavingStay(false);
      return;
    }

    try {
      const userRef = doc(db, "users", editingWorker.uid);
      const stayLocation = {
        address: stayAddress.trim(),
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        rawUrl: stayCoordsInput.trim(),
      };

      await updateDoc(userRef, { stayLocation });

      // Update local state
      setWorkers((prev) =>
        prev.map((w) => (w.uid === editingWorker.uid ? { ...w, stayLocation } : w))
      );

      showToast(`Stay location updated for ${editingWorker.name}`, "success");
      setEditingWorker(null);
    } catch (err) {
      console.error("Error updating stay location:", err);
      showToast("Failed to update stay location.", "error");
    } finally {
      setSavingStay(false);
    }
  };


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
    const fetchWorkers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersList: Worker[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Worker;
          // We only want to list workers and delivery personnel here
          if (data.role === "worker" || data.role === "delivery" || data.role === "delivery boy") {
            usersList.push({ ...data, uid: doc.id });
          }
        });
        setWorkers(usersList);
      } catch (error) {
        console.error("Error fetching workers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkers();
  }, []);

  const handleDelete = async (uid: string) => {
    const confirmed = await confirm({
      title: "Delete Worker Profile?",
      message: "Are you sure you want to delete this worker? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });

    if (confirmed) {
      try {
        await deleteDoc(doc(db, "users", uid));
        setWorkers((prev) => prev.filter((worker) => worker.uid !== uid));
        showToast("Worker deleted successfully.", "success");
      } catch (error) {
        console.error("Error deleting worker:", error);
        showToast("Failed to delete worker. Please try again.", "error");
      }
    }
  };

  const harvestingWorkers = workers.filter(w => w.role === "worker");
  const deliveryBoys = workers.filter(w => w.role === "delivery" || w.role === "delivery boy");

  const Table = ({ data, title, icon: Icon }: { data: Worker[], title: string, icon: any }) => (
    <div style={{ marginBottom: "3rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{ 
          background: "rgba(255, 153, 0, 0.1)", 
          padding: "0.5rem", 
          borderRadius: "8px",
          color: "var(--accent)"
        }}>
          <Icon size={20} />
        </div>
        <h3 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 600 }}>{title}</h3>
      </div>

      <div style={{ 
        background: "var(--surface)", 
        borderRadius: "16px", 
        border: "1px solid var(--surface-border)",
        overflow: "hidden"
      }}>
        {data.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-light)" }}>
            No users found in this category.
          </div>
        ) : (
          <div className="scroll-table-container">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ 
                  borderBottom: "1px solid var(--surface-border)", 
                  background: "rgba(0,0,0,0.2)" 
                }}>
                  <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase" }}>Full Name & DOB</th>
                  <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase" }}>Contact</th>
                  <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase" }}>Stay Room / Location</th>
                  <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((worker) => (
                  <tr key={worker.uid} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} className="hover-row">
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div style={{ fontWeight: 600 }}>{worker.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-light)", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Calendar size={12} /> {worker.dob || "N/A"}
                      </div>
                    </td>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div style={{ fontSize: "0.9rem", color: "var(--foreground)" }}>{worker.email}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-light)", marginTop: "0.3rem" }}>
                        {worker.phone}
                      </div>
                    </td>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      {worker.stayLocation ? (
                        <div>
                          <div style={{ fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "4px", color: "var(--accent)", fontWeight: 500 }}>
                            <MapPin size={14} />
                            <span>{worker.stayLocation.address}</span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-light)", marginTop: "2px" }}>
                            {worker.stayLocation.latitude.toFixed(5)}, {worker.stayLocation.longitude.toFixed(5)}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.82rem", color: "var(--text-light)", fontStyle: "italic" }}>
                          Not Allocated
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                      <button 
                        onClick={() => handleOpenEditStay(worker)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--accent)",
                          cursor: "pointer",
                          padding: "0.6rem",
                          borderRadius: "8px",
                          transition: "all 0.2s",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: "0.5rem"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 153, 0, 0.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        title="Edit Stay Location"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(worker.uid)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--error)",
                          cursor: "pointer",
                          padding: "0.6rem",
                          borderRadius: "8px",
                          transition: "all 0.2s",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 35, 60, 0.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      {/* Sidebar */}
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Workers Directory" />

        <div style={{ padding: "2.5rem", flex: 1, maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }}></div>
            </div>
          ) : (
            <>
              <Table data={harvestingWorkers} title="Harvesting Workers" icon={Activity} />
              <Table data={deliveryBoys} title="Delivery Boys" icon={Truck} />
            </>
          )}
        </div>

        {/* Edit Stay Location Modal */}
        {editingWorker && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}>
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "450px",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <MapPin size={24} color="var(--accent)" />
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Stay Location Allocation</h3>
                </div>
                <button 
                  onClick={() => setEditingWorker(null)}
                  style={{ background: "none", border: "none", color: "var(--text-light)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Set the stay address and coordinates for <strong>{editingWorker.name}</strong>. Multiple workers staying in the same house will automatically be grouped into a single pickup stop.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-light)", marginBottom: "6px", fontWeight: 600 }}>
                    Stay Address / Room Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 4, Green Villa Stay"
                    value={stayAddress}
                    onChange={(e) => setStayAddress(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--surface-2)",
                      border: "1px solid var(--surface-border)",
                      color: "white",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      outline: "none",
                      fontSize: "0.9rem",
                      fontFamily: "inherit"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-light)", marginBottom: "6px", fontWeight: 600 }}>
                    Coordinates or Google Maps Link
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9.9312, 76.2673"
                    value={stayCoordsInput}
                    onChange={(e) => setStayCoordsInput(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--surface-2)",
                      border: "1px solid var(--surface-border)",
                      color: "white",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      outline: "none",
                      fontSize: "0.9rem",
                      fontFamily: "inherit"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                <button
                  onClick={() => setEditingWorker(null)}
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
                  onClick={handleSaveStay}
                  disabled={savingStay}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                    border: "none",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    opacity: savingStay ? 0.7 : 1
                  }}
                >
                  {savingStay ? "Saving..." : "Save Location"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hover-row:hover {
          background: rgba(255,255,255,0.02) !important;
        }
      `}} />
    </div>
  );
}
