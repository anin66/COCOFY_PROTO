"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { Activity, Truck, Trash2, Calendar } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

interface Worker {
  uid: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  role: string;
  createdAt?: string;
}

export default function WorkersDirectory() {
  const router = useRouter();
  const [currentUserName, setCurrentUserName] = useState("Manager");
  const [currentUserRole, setCurrentUserRole] = useState("manager");
  const [workers, setWorkers] = useState<Worker[]>([]);
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
    if (window.confirm("Are you sure you want to delete this worker? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "users", uid));
        setWorkers((prev) => prev.filter((worker) => worker.uid !== uid));
      } catch (error) {
        console.error("Error deleting worker:", error);
        alert("Failed to delete worker. Please try again.");
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
          <div style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
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
                  <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Full Name & DOB</th>
                  <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Contact</th>
                  <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((worker) => (
                  <tr key={worker.uid} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} className="hover-row">
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div style={{ fontWeight: 600 }}>{worker.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Calendar size={12} /> {worker.dob || "N/A"}
                      </div>
                    </td>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.8)" }}>{worker.email}</div>
                      <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginTop: "0.3rem" }}>
                        {worker.phone}
                      </div>
                    </td>
                    <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
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
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hover-row:hover {
          background: rgba(255,255,255,0.02) !important;
        }
      `}} />
    </div>
  );
}
