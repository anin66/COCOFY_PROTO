"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { Trophy, Star, Mail, Phone, Calendar } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Worker {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  dob?: string;
  rankingPoints?: number;
}

export default function WorkerLeaderboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [userName, setUserName] = useState("Worker");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUid(user.uid);
      }
    });

    const q = query(collection(db, "users"), where("role", "==", "worker"));
    const unsubSnapshot = onSnapshot(q, (snapshot) => {
      const list: Worker[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Worker;
        list.push({ ...data, uid: doc.id, rankingPoints: data.rankingPoints ?? 0 });
      });
      // Sort descending
      list.sort((a, b) => (b.rankingPoints ?? 0) - (a.rankingPoints ?? 0));
      setWorkers(list);
      
      // Find current user name
      const me = list.find((w) => w.uid === auth.currentUser?.uid);
      if (me) {
        setUserName(me.name || "Worker");
      }
      
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubSnapshot();
    };
  }, []);

  const myRank = workers.findIndex((w) => w.uid === currentUid) + 1;
  const myPoints = workers.find((w) => w.uid === currentUid)?.rankingPoints ?? 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      {/* Sidebar */}
      <Sidebar userName={userName} userRole="WORKER" />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Leaderboard" />

        <div className="leaderboard-page-container" style={{ padding: "2rem", flex: 1, maxWidth: "1000px", width: "100%", margin: "0 auto" }}>
          
          {/* My Stats Banner */}
          {currentUid && !loading && (
            <div className="flex-stack-mobile" style={{
              background: "linear-gradient(135deg, rgba(123, 44, 191, 0.2) 0%, rgba(76, 201, 240, 0.1) 100%)",
              border: "1px solid rgba(123, 44, 191, 0.3)",
              borderRadius: "16px",
              padding: "1.5rem 2rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
              boxShadow: "0 8px 32px 0 rgba(123, 44, 191, 0.1)"
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Your Standing</h4>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                  Keep accepting jobs to climb the rankings and earn rewards!
                </p>
              </div>
              <div style={{ display: "flex", gap: "2rem" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent)" }}>
                    #{myRank > 0 ? myRank : "-"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase" }}>Rank</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--success)" }}>
                    {myPoints}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase" }}>Points</div>
                </div>
              </div>
            </div>
          )}

          {/* Table Area */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }}></div>
            </div>
          ) : workers.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "300px", background: "var(--surface)", border: "1px dashed var(--surface-border)",
              borderRadius: "16px", color: "rgba(255,255,255,0.4)", gap: "1rem"
            }}>
              <Trophy size={40} strokeWidth={1.5} />
              <div style={{ fontWeight: 600 }}>No Leaderboard Data</div>
            </div>
          ) : (
            <div style={{
              background: "var(--surface)",
              borderRadius: "16px",
              border: "1px solid var(--surface-border)",
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
            }}>
              <div className="scroll-table-container" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--surface-border)" }}>
                    <th style={thStyle}>Rank</th>
                    <th style={thStyle}>Worker Details</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Ranking Points</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((worker, index) => {
                    const points = worker.rankingPoints ?? 0;
                    const isTop3 = index < 3;
                    const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
                    const medalBg = isTop3 ? medalColors[index] : "rgba(255,255,255,0.1)";

                    return (
                      <tr key={worker.uid} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} className="hover-row">
                        {/* Rank Badge */}
                        <td style={tdStyle}>
                          <div style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            background: medalBg,
                            color: isTop3 ? "#000" : "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "0.85rem"
                          }}>
                            {index + 1}
                          </div>
                        </td>

                        {/* Name & Contact */}
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{worker.name}</div>
                          <div style={{ display: "flex", gap: "1rem", marginTop: "0.3rem", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
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
                        </td>
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
        
        @media (max-width: 768px) {
          .leaderboard-page-container {
            padding: 1rem !important;
          }
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
  color: "rgba(255,255,255,0.6)",
  textTransform: "uppercase"
};

const tdStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
  verticalAlign: "middle"
};
