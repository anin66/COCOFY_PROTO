"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { useToast } from "@/context/ToastContext";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, getDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { 
  PlusCircle, User, Phone, MapPin, Calendar, 
  TreePine, Briefcase, Trash2, Plus, Search, 
  Users, CheckCircle, IndianRupee, HelpCircle
} from "lucide-react";

interface Worker {
  uid: string;
  name: string;
  phone: string;
  email: string;
}

interface SelectedWorker {
  uid: string;
  name: string;
  phone: string;
  email: string;
  harvestedTrees: number;
}

export default function MiscellaneousJobsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  // Auth state
  const [currentUserName, setCurrentUserName] = useState("Manager");
  const [currentUserRole, setCurrentUserRole] = useState("manager");
  
  // Form states
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [pricePerTree, setPricePerTree] = useState("");
  const [workersRequired, setWorkersRequired] = useState<number>(0);
  
  // Worker selection states
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<SelectedWorker[]>([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Authenticate user
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

  // Listen for workers in database
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "worker"));
    const unsub = onSnapshot(q, (snapshot) => {
      const workersList: Worker[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        workersList.push({
          uid: d.id,
          name: data.name || "Unnamed Worker",
          phone: data.phone || "",
          email: data.email || "",
        });
      });
      workersList.sort((a, b) => a.name.localeCompare(b.name));
      setAllWorkers(workersList);
    }, (error) => {
      console.error("Error fetching workers:", error);
    });
    return () => unsub();
  }, []);

  // Update workers required count automatically to match selected workers, 
  // but keep it as a fallback editable field
  useEffect(() => {
    setWorkersRequired(selectedWorkers.length);
  }, [selectedWorkers.length]);

  // Filter workers based on search & exclude already selected ones
  const availableWorkers = allWorkers.filter((w) => {
    const isAlreadySelected = selectedWorkers.some((sw) => sw.uid === w.uid);
    const matchesSearch = w.name.toLowerCase().includes(workerSearch.toLowerCase()) || 
                          w.phone.includes(workerSearch);
    return !isAlreadySelected && matchesSearch;
  });

  const handleAddWorker = (worker: Worker) => {
    setSelectedWorkers((prev) => [
      ...prev,
      {
        uid: worker.uid,
        name: worker.name,
        phone: worker.phone,
        email: worker.email,
        harvestedTrees: 0,
      },
    ]);
    setWorkerSearch("");
    setDropdownOpen(false);
  };

  const handleRemoveWorker = (uid: string) => {
    setSelectedWorkers((prev) => prev.filter((w) => w.uid !== uid));
  };

  const handleHarvestChange = (uid: string, amount: number) => {
    setSelectedWorkers((prev) =>
      prev.map((w) => (w.uid === uid ? { ...w, harvestedTrees: Math.max(0, amount) } : w))
    );
  };

  // Calculations
  const totalHarvested = selectedWorkers.reduce((sum, w) => sum + (w.harvestedTrees || 0), 0);
  const parsedPrice = parseFloat(pricePerTree) || 0;
  const totalPayout = totalHarvested * parsedPrice;

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      showToast("Customer name is required.", "error");
      return;
    }
    if (!phone.trim()) {
      showToast("Customer phone number is required.", "error");
      return;
    }
    if (!location.trim()) {
      showToast("Job location is required.", "error");
      return;
    }
    if (!pricePerTree || parsedPrice <= 0) {
      showToast("Please enter a valid price per tree.", "error");
      return;
    }
    if (selectedWorkers.length === 0) {
      showToast("Please assign at least one worker to this job.", "error");
      return;
    }

    setSubmitting(true);

    try {
      const newJob = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        location: location.trim(),
        date: date,
        trees: totalHarvested,
        workersRequired: workersRequired > 0 ? workersRequired : selectedWorkers.length,
        pricePerTree: String(parsedPrice),
        status: "ARCHIVED",
        createdAt: new Date().toISOString(),
        assignedDelivery: null,
        isMiscellaneous: true,
        assignedWorkers: selectedWorkers.map((w) => ({
          uid: w.uid,
          name: w.name,
          status: "accepted",
          harvestedTrees: w.harvestedTrees,
          harvestConfirmed: true,
        })),
      };

      await addDoc(collection(db, "jobs"), newJob);

      showToast("Miscellaneous job completed and recorded successfully!", "success");
      
      // Reset form
      setCustomerName("");
      setPhone("");
      setLocation("");
      setDate(new Date().toISOString().split("T")[0]);
      setPricePerTree("");
      setSelectedWorkers([]);
      setWorkerSearch("");
    } catch (err) {
      console.error("Error creating miscellaneous job:", err);
      showToast("Failed to save job. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar title="Miscellaneous Job" />

        <div className="misc-page-container" style={{ padding: "2rem", flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Log Completed One-Off Jobs</h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-light)" }}>
              Manually add small tasks or completed ad-hoc works. These jobs bypass scheduling and go straight to Job History and Finance Overview.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            
            {/* Left Column - Details */}
            <div className="form-card" style={{
              flex: "1 1 450px", background: "var(--surface)", 
              border: "1px solid var(--surface-border)", borderRadius: "18px",
              padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid var(--surface-border)", paddingBottom: "0.75rem", marginBottom: "0.25rem" }}>
                <PlusCircle size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Job Details</h3>
              </div>

              {/* Customer Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <User size={14} /> Customer Name
                </label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                    color: "white", padding: "0.75rem 1rem", borderRadius: "10px",
                    outline: "none", fontFamily: "inherit", fontSize: "0.9rem"
                  }}
                  required
                />
              </div>

              {/* Phone */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <Phone size={14} /> Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="Enter customer phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                    color: "white", padding: "0.75rem 1rem", borderRadius: "10px",
                    outline: "none", fontFamily: "inherit", fontSize: "0.9rem"
                  }}
                  required
                />
              </div>

              {/* Location */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <MapPin size={14} /> Location (Plain Text)
                </label>
                <input
                  type="text"
                  placeholder="Enter location name (e.g. Vattambalam)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{
                    background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                    color: "white", padding: "0.75rem 1rem", borderRadius: "10px",
                    outline: "none", fontFamily: "inherit", fontSize: "0.9rem"
                  }}
                  required
                />
              </div>

              {/* Date & Rate Row */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "150px" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <Calendar size={14} /> Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{
                      background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                      color: "white", padding: "0.75rem 1rem", borderRadius: "10px",
                      outline: "none", fontFamily: "inherit", fontSize: "0.9rem", colorScheme: "dark"
                    }}
                    required
                  />
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "150px" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <IndianRupee size={14} /> Price Per Tree
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Rate per tree"
                    value={pricePerTree}
                    onChange={(e) => setPricePerTree(e.target.value)}
                    style={{
                      background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                      color: "white", padding: "0.75rem 1rem", borderRadius: "10px",
                      outline: "none", fontFamily: "inherit", fontSize: "0.9rem"
                    }}
                    required
                  />
                </div>
              </div>

              {/* Workers Count */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <Users size={14} /> How many workers worked?
                </label>
                <input
                  type="number"
                  min="0"
                  value={workersRequired}
                  onChange={(e) => setWorkersRequired(parseInt(e.target.value) || 0)}
                  style={{
                    background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                    color: "white", padding: "0.75rem 1rem", borderRadius: "10px",
                    outline: "none", fontFamily: "inherit", fontSize: "0.9rem"
                  }}
                  placeholder="Defaults to assigned workers count"
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>
                  Leaves a record of required workers for Job History details.
                </span>
              </div>
            </div>

            {/* Right Column - Worker selection & tree counts */}
            <div className="form-card" style={{
              flex: "1.2 1 500px", background: "var(--surface)", 
              border: "1px solid var(--surface-border)", borderRadius: "18px",
              padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem"
            }}>
              
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid var(--surface-border)", paddingBottom: "0.75rem", marginBottom: "0.25rem" }}>
                <Users size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Workers & Harvest Summary</h3>
              </div>

              {/* Worker Search Selector Dropdown */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)" }}>
                  Assign Workers who worked
                </label>
                <div style={{ position: "relative" }}>
                  <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
                  <input
                    type="text"
                    placeholder="Search worker by name..."
                    value={workerSearch}
                    onChange={(e) => {
                      setWorkerSearch(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    style={{
                      width: "100%", background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                      color: "white", padding: "0.75rem 1rem 0.75rem 2.5rem", borderRadius: "10px",
                      outline: "none", fontFamily: "inherit", fontSize: "0.9rem"
                    }}
                  />
                </div>

                {/* Dropdown Options */}
                {dropdownOpen && workerSearch && (
                  <>
                    <div 
                      onClick={() => setDropdownOpen(false)} 
                      style={{ position: "fixed", inset: 0, zIndex: 10 }}
                    />
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0,
                      maxHeight: "200px", overflowY: "auto", background: "var(--surface)",
                      border: "1px solid var(--surface-border)", borderRadius: "10px",
                      marginTop: "4px", zIndex: 20, boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
                    }}>
                      {availableWorkers.length === 0 ? (
                        <div style={{ padding: "0.8rem 1rem", fontSize: "0.85rem", color: "var(--text-light)", textAlign: "center" }}>
                          No workers match search
                        </div>
                      ) : (
                        availableWorkers.map((w) => (
                          <div
                            key={w.uid}
                            onClick={() => handleAddWorker(w)}
                            style={{
                              padding: "0.75rem 1rem", fontSize: "0.88rem", color: "white",
                              cursor: "pointer", transition: "background 0.2s",
                              borderBottom: "1px solid rgba(255,255,255,0.03)"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <div style={{ fontWeight: 600 }}>{w.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{w.phone || w.email}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Selected Workers List */}
              <div style={{ flex: 1, minHeight: "150px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {selectedWorkers.length === 0 ? (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    flex: 1, border: "1px dashed var(--surface-border)", borderRadius: "12px",
                    color: "var(--text-dim)", gap: "0.5rem", padding: "2rem"
                  }}>
                    <Users size={32} strokeWidth={1.5} />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>No workers added yet</span>
                    <span style={{ fontSize: "0.72rem", textAlign: "center" }}>Type in the search field above and select workers who worked.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>
                      Assignee & Tree Counts
                    </div>
                    {selectedWorkers.map((worker) => (
                      <div
                        key={worker.uid}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                          padding: "0.6rem 0.85rem", borderRadius: "10px", gap: "1rem"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "white" }}>{worker.name}</span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-light)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {worker.phone || worker.email}
                          </span>
                        </div>

                        {/* Harvest Count Input */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="Trees"
                            value={worker.harvestedTrees || ""}
                            onChange={(e) => handleHarvestChange(worker.uid, parseInt(e.target.value) || 0)}
                            style={{
                              width: "80px", background: "var(--surface)", border: "1px solid var(--surface-border)",
                              color: "white", padding: "0.4rem 0.5rem", borderRadius: "6px",
                              outline: "none", fontFamily: "inherit", fontSize: "0.85rem", textAlign: "center"
                            }}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveWorker(worker.uid)}
                            style={{
                              background: "rgba(239, 35, 60, 0.08)", color: "var(--error)",
                              border: "1px solid rgba(239, 35, 60, 0.15)", borderRadius: "6px",
                              width: "28px", height: "28px", display: "flex", alignItems: "center",
                              justifyContent: "center", cursor: "pointer", transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--error)";
                              e.currentTarget.style.color = "white";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(239, 35, 60, 0.08)";
                              e.currentTarget.style.color = "var(--error)";
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary Stats Card */}
              {selectedWorkers.length > 0 && (
                <div style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(5,150,105,0.05) 100%)",
                  border: "1px solid rgba(16,185,129,0.2)", borderRadius: "14px",
                  padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--text-light)" }}>Total Trees Harvested</span>
                    <strong style={{ color: "white", fontSize: "1rem" }}>{totalHarvested}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.6rem" }}>
                    <span style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>Total Payout Amount</span>
                    <strong style={{ color: "#10b981", fontSize: "1.35rem" }}>
                      Rs. {totalPayout.toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%", padding: "0.9rem",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                  color: "white", border: "none", borderRadius: "12px",
                  fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  fontSize: "0.95rem", boxShadow: "0 10px 20px -10px var(--primary-glow-border)",
                  transition: "opacity 0.2s", opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
                    Saving Job Record...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Log Job & Send to Finance
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
      
      {/* Dynamic Spinner & Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .misc-page-container {
          animation: misc-fade-in 0.4s ease-out;
        }
        @keyframes misc-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .form-card {
          box-shadow: 0 10px 30px -15px rgba(0,0,0,0.3);
          transition: border-color 0.3s ease;
        }
        .form-card:hover {
          border-color: rgba(255, 255, 255, 0.08) !important;
        }
      `}} />
    </div>
  );
}
