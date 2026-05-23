"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { 
  IndianRupee, Calendar, TreePine, Award, 
  TrendingUp, Info, CheckCircle2, AlertCircle, Sparkles
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface SalaryPlan {
  id: string;
  name: string;
  baseCount: number;
  baseSalary: number;
  pushCount: number;
  incentive: number;
}

interface AssignedWorker {
  uid: string;
  name: string;
  status: "pending" | "accepted" | "rejected";
  harvestedTrees?: number;
  harvestConfirmed?: boolean;
}

interface Job {
  id: string;
  customerName: string;
  location: string;
  date: string;
  status: string;
  assignedWorkers?: AssignedWorker[];
}

export default function WorkerSalary() {
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [workerName, setWorkerName] = useState("Worker");
  const [activePlan, setActivePlan] = useState<SalaryPlan | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Date selection states (default to current month/year)
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const years = [2025, 2026, 2027];

  const [jobsLoading, setJobsLoading] = useState(true);

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUid(user.uid);
      } else {
        setLoading(false);
        setJobsLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Fetch worker info + plan + jobs — all in parallel for speed
  useEffect(() => {
    if (!currentUid) return;

    let unsubJobs: (() => void) | null = null;

    // Fetch user profile and plan in parallel (one-time reads, fast)
    const fetchProfileAndPlan = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", currentUid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setWorkerName(userData.name || "Worker");

          const planId = userData.planId;
          if (planId) {
            // Fetch plan in parallel without blocking job listener
            getDoc(doc(db, "plans", planId)).then((planSnap) => {
              if (planSnap.exists()) {
                setActivePlan({ id: planSnap.id, ...planSnap.data() } as SalaryPlan);
              } else {
                setActivePlan(null);
              }
              setLoading(false);
            });
          } else {
            setActivePlan(null);
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching user/plan:", err);
        setLoading(false);
      }
    };

    // Start profile fetch immediately (non-blocking)
    fetchProfileAndPlan();

    // Set up real-time jobs listener in parallel
    unsubJobs = onSnapshot(collection(db, "jobs"), (snapshot) => {
      const jobsList: Job[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const assignedWorkers = (data.assignedWorkers || []) as AssignedWorker[];
        if (assignedWorkers.some(w => w.uid === currentUid && w.status === "accepted")) {
          jobsList.push({ id: d.id, ...data } as Job);
        }
      });
      setJobs(jobsList);
      setJobsLoading(false);
    }, (error) => {
      console.error("Error listening to jobs:", error);
      setJobsLoading(false);
    });

    return () => {
      if (unsubJobs) unsubJobs();
    };
  }, [currentUid]);

  // Filter jobs by selected month and year
  const filteredJobs = jobs.filter((job) => {
    if (!job.date) return false;
    const d = new Date(job.date);
    return !isNaN(d.getTime()) && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Calculate confirmed harvested trees in selected month
  const confirmedHarvestedTrees = filteredJobs.reduce((sum, job) => {
    // Only count completed/archived jobs where harvest has been confirmed
    const isJobCompleted = job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED";
    if (!isJobCompleted) return sum;

    const myWorkerRecord = job.assignedWorkers?.find(w => w.uid === currentUid);
    if (myWorkerRecord && myWorkerRecord.harvestConfirmed && myWorkerRecord.harvestedTrees) {
      return sum + myWorkerRecord.harvestedTrees;
    }
    return sum;
  }, 0);

  // Detailed salary calculation logic
  const calculateSalaryBreakdown = () => {
    if (!activePlan) return {
      baseSalaryEarned: 0,
      pushBonusEarned: 0,
      extraIncentiveEarned: 0,
      totalIncentives: 0,
      totalSalary: 0,
      tier: "none"
    };

    const { baseCount, baseSalary, pushCount, incentive } = activePlan;
    const completed = confirmedHarvestedTrees;

    let baseSalaryEarned = 0;
    let pushBonusEarned = 0;
    let extraIncentiveEarned = 0;
    let tier = "prorated";

    if (completed < baseCount) {
      // Under base count: Prorated base salary, no incentives
      baseSalaryEarned = Math.round((completed / baseCount) * baseSalary);
      tier = "under-base";
    } else if (completed < pushCount) {
      // Hit base count but below push target
      baseSalaryEarned = baseSalary;
      extraIncentiveEarned = (completed - baseCount) * incentive;
      tier = "base-achieved";
    } else {
      // Hit or exceeded push target
      baseSalaryEarned = baseSalary;
      pushBonusEarned = pushCount * incentive; // Push bonus locks at the push count trees
      extraIncentiveEarned = (completed - pushCount) * incentive; // Extra counts paid normally
      tier = "push-achieved";
    }

    const totalIncentives = pushBonusEarned + extraIncentiveEarned;
    const totalSalary = baseSalaryEarned + totalIncentives;

    return {
      baseSalaryEarned,
      pushBonusEarned,
      extraIncentiveEarned,
      totalIncentives,
      totalSalary,
      tier
    };
  };

  const breakdown = calculateSalaryBreakdown();

  // Progress Bar Percentages
  const getProgressStats = () => {
    if (!activePlan) return { basePercent: 0, pushPercent: 0 };
    const { baseCount, pushCount } = activePlan;
    
    const basePercent = Math.min((confirmedHarvestedTrees / baseCount) * 100, 100);
    
    // Push progress starts from base count up to push target
    const pushSpan = pushCount - baseCount;
    const currentPushCount = Math.max(0, confirmedHarvestedTrees - baseCount);
    const pushPercent = Math.min((currentPushCount / pushSpan) * 100, 100);

    return { basePercent, pushPercent };
  };

  const progress = getProgressStats();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      {/* Sidebar */}
      <Sidebar userName={workerName} userRole="WORKER" />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Salary & Performance" />

        <div className="salary-page-container" style={{ padding: "2.5rem", flex: 1, maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          
          {/* Top Selection Bar */}
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem 0" }}>Monthly Statement</h3>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.88rem" }}>
                Track your trees harvested, plan goals, and computed pay breakdown.
              </p>
            </div>
            
            {/* Date Selectors */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--surface-border)",
                  color: "white",
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px",
                  outline: "none",
                  fontWeight: 650,
                  fontFamily: "inherit",
                  cursor: "pointer"
                }}
              >
                {months.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--surface-border)",
                  color: "white",
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px",
                  outline: "none",
                  fontWeight: 650,
                  fontFamily: "inherit",
                  cursor: "pointer"
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }} />
            </div>
          ) : !activePlan ? (
            /* Warning if Plan is unassigned */
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "350px",
              background: "rgba(239, 35, 60, 0.03)",
              backdropFilter: "blur(12px)",
              borderRadius: "20px",
              border: "1px dashed var(--error)",
              padding: "2rem",
              textAlign: "center",
              gap: "1.25rem"
            }}>
              <AlertCircle size={48} color="var(--error)" />
              <div>
                <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "white" }}>No Salary Package Assigned</h4>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", maxWidth: "450px", lineHeight: 1.6 }}>
                  You have not been assigned to a salary package by the manager. Your monthly performance statement will display once a plan is assigned. Please get in touch with your dashboard administrator.
                </p>
              </div>
            </div>
          ) : (
            /* Main Dashboard Content when plan exists */
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              
              {/* Row 1: Package & Earnings Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                
                {/* Active Plan Detail Card */}
                <div style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "16px",
                  padding: "1.75rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                    <Sparkles size={20} color="var(--accent)" />
                    <h4 style={{ fontSize: "1.2rem", margin: 0, fontWeight: 700 }}>Active Package: {activePlan.name}</h4>
                  </div>

                  <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                    Your targets are set on a calendar month basis. Hitting higher target tiers unlocks incentives.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", fontWeight: 550, textTransform: "uppercase" }}>Base Count</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.2rem" }}>{activePlan.baseCount} trees</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", fontWeight: 550, textTransform: "uppercase" }}>Base Salary</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#06d6a0", marginTop: "0.2rem" }}>₹{activePlan.baseSalary.toLocaleString()}</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", fontWeight: 550, textTransform: "uppercase" }}>Push Target</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.2rem" }}>{activePlan.pushCount} trees</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", fontWeight: 550, textTransform: "uppercase" }}>Incentive Rate</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)", marginTop: "0.2rem" }}>₹{activePlan.incentive} / tree</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255,255,255,0.02)", padding: "0.85rem 1rem", borderRadius: "10px", marginTop: "1.25rem", border: "1px dashed var(--surface-border)" }}>
                    <Info size={18} color="var(--primary-hover)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
                      Reaching the <strong>{activePlan.pushCount}</strong> push target awards you the incentive of <strong>₹{activePlan.incentive}</strong> for <em>all</em> harvested trees up to 600 (a ₹{(activePlan.pushCount * activePlan.incentive).toLocaleString()} bonus), plus ₹{activePlan.incentive} for each tree above that!
                    </div>
                  </div>
                </div>

                {/* Monthly Earnings Card */}
                <div style={{
                  background: "linear-gradient(135deg, var(--primary-glow) 0%, var(--accent-glow) 100%)",
                  border: "1px solid var(--primary-glow-border)",
                  borderRadius: "16px",
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                        Estimated Salary ({months[selectedMonth]} {selectedYear})
                      </span>
                      <div style={{
                        background: breakdown.tier === "push-achieved" ? "rgba(6,214,160,0.12)" : breakdown.tier === "base-achieved" ? "rgba(76,201,240,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${breakdown.tier === "push-achieved" ? "#06d6a0" : breakdown.tier === "base-achieved" ? "var(--accent)" : "var(--surface-border)"}`,
                        color: breakdown.tier === "push-achieved" ? "#06d6a0" : breakdown.tier === "base-achieved" ? "var(--accent)" : "rgba(255,255,255,0.6)",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "100px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase"
                      }}>
                        {breakdown.tier === "push-achieved" ? "🔥 Push Bonus Active" : breakdown.tier === "base-achieved" ? "✓ Base Met" : "Prorating"}
                      </div>
                    </div>

                    <h3 style={{ fontSize: "2.5rem", margin: "0 0 1.25rem 0", color: "#06d6a0", display: "flex", alignItems: "baseline", gap: "0.1rem" }}>
                      <span style={{ fontSize: "1.5rem", fontWeight: 500 }}>₹</span>
                      {breakdown.totalSalary.toLocaleString()}
                    </h3>

                    {/* Detailed Breakdown List */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>Base Salary:</span>
                        <span style={{ color: "white", fontWeight: 600 }}>₹{breakdown.baseSalaryEarned.toLocaleString()}</span>
                      </div>
                      
                      {breakdown.pushBonusEarned > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>Push Value Bonus ({activePlan.pushCount} trees):</span>
                          <span style={{ color: "var(--accent)", fontWeight: 600 }}>+ ₹{breakdown.pushBonusEarned.toLocaleString()}</span>
                        </div>
                      )}

                      {confirmedHarvestedTrees >= activePlan.baseCount && confirmedHarvestedTrees < activePlan.pushCount && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>Incentives ({confirmedHarvestedTrees - activePlan.baseCount} extra trees):</span>
                          <span style={{ color: "var(--accent)", fontWeight: 600 }}>+ ₹{breakdown.extraIncentiveEarned.toLocaleString()}</span>
                        </div>
                      )}

                      {confirmedHarvestedTrees > activePlan.pushCount && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>Extra incentives ({confirmedHarvestedTrees - activePlan.pushCount} trees above target):</span>
                          <span style={{ color: "var(--accent)", fontWeight: 600 }}>+ ₹{breakdown.extraIncentiveEarned.toLocaleString()}</span>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.08)", paddingTop: "0.6rem", marginTop: "0.2rem" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>Total Incentive Bonus:</span>
                        <span style={{ color: "var(--accent)", fontWeight: 700 }}>₹{breakdown.totalIncentives.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginTop: "1rem" }}>
                    <Calendar size={14} />
                    <span>Calculated from {filteredJobs.length} monthly jobs</span>
                  </div>
                </div>

              </div>

              {/* Row 2: Performance Progress Bars */}
              <div className="performance-progress-card" style={{
                background: "var(--surface-2)",
                border: "1px solid var(--surface-border)",
                borderRadius: "16px",
                padding: "2rem"
              }}>
                <h4 style={{ fontSize: "1.2rem", margin: "0 0 1.5rem 0", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <TreePine size={18} color="var(--accent)" />
                  Performance Targets Progress
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
                  {/* Tier 1: Base Count Progress */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "white" }}>
                        Tier 1: Base Target ({activePlan.baseCount} Trees)
                      </span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: confirmedHarvestedTrees >= activePlan.baseCount ? "#06d6a0" : "rgba(255,255,255,0.6)" }}>
                        {confirmedHarvestedTrees} / {activePlan.baseCount} trees
                        {confirmedHarvestedTrees >= activePlan.baseCount && " (Met)"}
                      </span>
                    </div>

                    <div style={{ height: "10px", background: "rgba(0,0,0,0.3)", borderRadius: "100px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{
                        height: "100%",
                        width: `${progress.basePercent}%`,
                        background: confirmedHarvestedTrees >= activePlan.baseCount 
                          ? "linear-gradient(90deg, var(--primary) 0%, #06d6a0 100%)" 
                          : "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)",
                        borderRadius: "100px",
                        transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
                      }} />
                    </div>
                  </div>

                  {/* Tier 2: Push Target Progress */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "white", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        Tier 2: Push Target ({activePlan.pushCount} Trees)
                        {confirmedHarvestedTrees >= activePlan.pushCount && <Sparkles size={14} color="#06d6a0" />}
                      </span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: confirmedHarvestedTrees >= activePlan.pushCount ? "#06d6a0" : "rgba(255,255,255,0.6)" }}>
                        {confirmedHarvestedTrees >= activePlan.baseCount 
                          ? `${confirmedHarvestedTrees} / ${activePlan.pushCount} trees` 
                          : `Complete Base First`}
                        {confirmedHarvestedTrees >= activePlan.pushCount && " (Max Bonus Activated!)"}
                      </span>
                    </div>

                    <div style={{ height: "10px", background: "rgba(0,0,0,0.3)", borderRadius: "100px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{
                        height: "100%",
                        width: `${progress.pushPercent}%`,
                        background: confirmedHarvestedTrees >= activePlan.pushCount 
                          ? "linear-gradient(90deg, var(--accent) 0%, #06d6a0 100%)" 
                          : "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)",
                        borderRadius: "100px",
                        opacity: confirmedHarvestedTrees >= activePlan.baseCount ? 1 : 0.25,
                        transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Month Completed Jobs Log */}
              <div style={{
                background: "var(--surface)",
                borderRadius: "16px",
                border: "1px solid var(--surface-border)",
                overflow: "hidden"
              }}>
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ fontSize: "1.1rem", margin: 0, fontWeight: 700 }}>Monthly Work History ({months[selectedMonth]})</h4>
                  <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Only completed/archived jobs contribute</span>
                </div>

                {jobsLoading ? (
                  <SkeletonTable rows={5} cols={5} />
                ) : filteredJobs.length === 0 ? (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>
                    No job assignments logged for this month.
                  </div>
                ) : (
                  <div className="scroll-table-container" style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(0,0,0,0.1)" }}>
                        <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Job Date</th>
                        <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Customer</th>
                        <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Location</th>
                        <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Status</th>
                        <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Harvested Trees</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => {
                        const myWorkerRecord = job.assignedWorkers?.find(w => w.uid === currentUid);
                        const isJobCompleted = job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED";
                        const harvestCount = myWorkerRecord?.harvestedTrees || 0;
                        const isConfirmed = myWorkerRecord?.harvestConfirmed || false;

                        return (
                          <tr key={job.id} style={{ borderBottom: "1px solid var(--surface-border)" }}>
                            <td style={{ padding: "1rem 1.5rem", fontSize: "0.88rem", color: "var(--foreground)" }}>{job.date}</td>
                            <td style={{ padding: "1rem 1.5rem", fontSize: "0.88rem", fontWeight: 600 }}>{job.customerName}</td>
                            <td style={{ padding: "1rem 1.5rem", fontSize: "0.88rem", color: "var(--text-muted)" }}>{job.location}</td>
                            <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                              <span style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                textTransform: "uppercase",
                                ...(isJobCompleted 
                                  ? { background: "rgba(6,214,160,0.1)", color: "#06d6a0" }
                                  : { background: "rgba(245,158,11,0.1)", color: "#f59e0b" })
                              }}>
                                {isJobCompleted ? "Completed" : "In Progress"}
                              </span>
                            </td>
                            <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.88rem", fontWeight: 700 }}>
                              {isJobCompleted ? (
                                isConfirmed ? (
                                  <span style={{ color: "#06d6a0" }}>{harvestCount} trees</span>
                                ) : (
                                  <span style={{ color: "#f59e0b", fontSize: "0.8rem", fontWeight: 550 }}>Confirm Pending</span>
                                )
                              ) : (
                                <span style={{ color: "var(--text-dim)" }}>--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </div>

            </div>
          )}
        </div>
      </main>
      <style dangerouslySetInnerHTML={{ __html: `
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .salary-page-container {
            padding: 1rem !important;
          }
          .performance-progress-card {
            padding: 1.25rem !important;
          }
        }
      `}} />
    </div>
  );
}
