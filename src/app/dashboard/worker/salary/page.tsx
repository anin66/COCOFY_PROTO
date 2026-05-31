"use client";

import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { 
  IndianRupee, Calendar, TreePine, Award, 
  TrendingUp, Info, CheckCircle2, AlertCircle, Sparkles, ChevronRight
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

interface Payout {
  id: string;
  workerUid: string;
  cycleNumber: number;
  startDate: string;
  endDate: string;
  treesHarvested: number;
  baseSalaryEarned: number;
  incentivesEarned: number;
  incentivesIncluded: boolean;
  amountPaid: number;
  paidAt: string;
  paymentMethod: string;
  receiverName?: string;
  notes?: string;
}

interface CalculatedCycle {
  cycleNumber: number;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
  isPaid: boolean;
  payoutDetails: Payout | null;
  treesHarvested: number;
  baseSalaryEarned: number;
  incentivesEarned: number;
  totalSalary: number;
  tier: string;
  daysRemaining: number;
  cycleJobs: Job[];
}

export default function WorkerSalary() {
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [workerName, setWorkerName] = useState("Worker");
  const [planAssignedAt, setPlanAssignedAt] = useState<string | null>(null);
  const [workerCreatedAt, setWorkerCreatedAt] = useState<string | null>(null);
  
  const [activePlan, setActivePlan] = useState<SalaryPlan | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Selected Cycle Index state (0 is usually the latest cycle)
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);

  // Auth synchronization
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

  // Fetch worker profiles, active plan, jobs, and payouts in parallel
  useEffect(() => {
    if (!currentUid) return;

    let unsubJobs: (() => void) | null = null;
    let unsubPayouts: (() => void) | null = null;

    // Fetch user details first
    const fetchUserProfile = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", currentUid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setWorkerName(userData.name || "Worker");
          setPlanAssignedAt(userData.planAssignedAt || null);
          setWorkerCreatedAt(userData.createdAt || null);

          const planId = userData.planId;
          if (planId) {
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
        console.error("Error loading user profile:", err);
        setLoading(false);
      }
    };

    fetchUserProfile();

    // Listen to worker jobs in real-time
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
      console.error("Jobs fetch error:", error);
      setJobsLoading(false);
    });

    // Listen to worker payouts in real-time
    unsubPayouts = onSnapshot(collection(db, "payouts"), (snapshot) => {
      const payoutsList: Payout[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Payout;
        if (data.workerUid === currentUid) {
          payoutsList.push({ ...data, id: d.id });
        }
      });
      setPayouts(payoutsList);
    }, (error) => {
      console.error("Payouts fetch error:", error);
    });

    return () => {
      if (unsubJobs) unsubJobs();
      if (unsubPayouts) unsubPayouts();
    };
  }, [currentUid]);

  // Compute all 30-day cycles starting from plan appointment date
  const cycles = useMemo<CalculatedCycle[]>(() => {
    if (!activePlan) return [];

    // Cycle starts at planAssignedAt, falls back to profile creation, then fallback timestamp
    const startDateStr = planAssignedAt || workerCreatedAt || "2026-05-01";
    const start = new Date(startDateStr);
    const now = new Date();
    const cycleDurationMs = 30 * 24 * 60 * 60 * 1000;
    const computedCycles: CalculatedCycle[] = [];

    let cycleNumber = 1;
    let currentCycleStart = new Date(start);

    while (currentCycleStart < now || cycleNumber === 1) {
      const currentCycleEnd = new Date(currentCycleStart.getTime() + cycleDurationMs);
      
      // Filter jobs belonging to this worker that fall within this 30-day cycle range
      const cycleJobs = jobs.filter((job) => {
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        const isWithinCycle = jobDate >= currentCycleStart && jobDate < currentCycleEnd;
        if (!isWithinCycle) return false;

        // Must be completed/archived jobs
        const isCompleted = job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED";
        if (!isCompleted) return false;

        const myAssignedRecord = job.assignedWorkers?.find((w) => w.uid === currentUid);
        return myAssignedRecord && myAssignedRecord.harvestConfirmed && myAssignedRecord.status === "accepted";
      });

      // Compute total trees harvested in this cycle
      const treesHarvested = cycleJobs.reduce((sum, job) => {
        const myAssignedRecord = job.assignedWorkers?.find((w) => w.uid === currentUid);
        return sum + (myAssignedRecord?.harvestedTrees || 0);
      }, 0);

      // Perform pricing/performance tier calculations
      const { baseCount, baseSalary, pushCount, incentive } = activePlan;
      let baseSalaryEarned = 0;
      let pushBonusEarned = 0;
      let extraIncentiveEarned = 0;
      let tier = "prorated";

      if (treesHarvested < baseCount) {
        baseSalaryEarned = Math.round((treesHarvested / baseCount) * baseSalary);
        tier = "under-base";
      } else if (treesHarvested < pushCount) {
        baseSalaryEarned = baseSalary;
        extraIncentiveEarned = (treesHarvested - baseCount) * incentive;
        tier = "base-achieved";
      } else {
        baseSalaryEarned = baseSalary;
        pushBonusEarned = pushCount * incentive;
        extraIncentiveEarned = (treesHarvested - pushCount) * incentive;
        tier = "push-achieved";
      }

      const totalIncentives = pushBonusEarned + extraIncentiveEarned;
      const totalSalary = baseSalaryEarned + totalIncentives;

      // Check if payout document exists in state payouts
      const payoutDoc = payouts.find(
        (p) => p.cycleNumber === cycleNumber
      ) || null;
      
      const isPaid = !!payoutDoc;
      const isCompleted = currentCycleEnd <= now;

      computedCycles.push({
        cycleNumber,
        startDate: currentCycleStart.toISOString().split("T")[0],
        endDate: currentCycleEnd.toISOString().split("T")[0],
        isCompleted,
        isPaid,
        payoutDetails: payoutDoc,
        treesHarvested,
        baseSalaryEarned,
        incentivesEarned: totalIncentives,
        totalSalary,
        tier,
        daysRemaining: isCompleted ? 0 : Math.max(0, Math.ceil((currentCycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
        cycleJobs
      });

      currentCycleStart = currentCycleEnd;
      cycleNumber++;

      if (!isCompleted) {
        break;
      }
    }

    // Newest cycles first
    return computedCycles.reverse();
  }, [activePlan, planAssignedAt, workerCreatedAt, jobs, payouts, currentUid]);

  // Selected Cycle data
  const selectedCycle = useMemo<CalculatedCycle | null>(() => {
    if (cycles.length === 0) return null;
    return cycles[selectedCycleIndex] || cycles[0] || null;
  }, [cycles, selectedCycleIndex]);

  // Progress Bar percentages for the selected cycle
  const progressPercent = useMemo(() => {
    if (!activePlan || !selectedCycle) return { basePercent: 0, pushPercent: 0 };
    const { baseCount, pushCount } = activePlan;
    const harvested = selectedCycle.treesHarvested;
    
    const basePercent = Math.min((harvested / baseCount) * 100, 100);
    
    const pushSpan = pushCount - baseCount;
    const currentPushCount = Math.max(0, harvested - baseCount);
    const pushPercent = Math.min((currentPushCount / pushSpan) * 100, 100);

    return { basePercent, pushPercent };
  }, [activePlan, selectedCycle]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={workerName} userRole="WORKER" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Salary & Performance" />

        <div className="salary-page-container" style={{ padding: "2.5rem", flex: 1, maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          
          {/* Statement Header Controls */}
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem 0" }}>Salary Cycle Statement</h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.88rem" }}>
                Track your harvested trees, plan thresholds, and payout cycle status.
              </p>
            </div>
            
            {/* Cycle selector dropdown */}
            {activePlan && cycles.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-light)", fontWeight: 550 }}>Select Period:</span>
                <select
                  value={selectedCycleIndex}
                  onChange={(e) => setSelectedCycleIndex(Number(e.target.value))}
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--surface-border)",
                    color: "white",
                    padding: "0.6rem 1.2rem",
                    borderRadius: "8px",
                    outline: "none",
                    fontWeight: 650,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    minWidth: "220px"
                  }}
                >
                  {cycles.map((cycle, idx) => {
                    const statusText = cycle.isPaid 
                      ? `Paid - ₹${(cycle.payoutDetails?.amountPaid || cycle.totalSalary).toLocaleString()}` 
                      : cycle.isCompleted 
                        ? "Completed (Pending Pay)" 
                        : `In Progress (Day ${30 - cycle.daysRemaining}/30)`;

                    return (
                      <option key={cycle.cycleNumber} value={idx} style={{ backgroundColor: "#0b1a0e", color: "white" }}>
                        Cycle {cycle.cycleNumber} ({statusText})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }} />
            </div>
          ) : !activePlan ? (
            /* Warning panel if Plan is unassigned */
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "350px", background: "rgba(239, 35, 60, 0.03)", backdropFilter: "blur(12px)",
              borderRadius: "20px", border: "1px dashed var(--error)", padding: "2rem", textAlign: "center", gap: "1.25rem"
            }}>
              <AlertCircle size={48} color="var(--error)" />
              <div>
                <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "white" }}>No Salary Package Assigned</h4>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: "450px", lineHeight: 1.6 }}>
                  You have not been assigned to a salary package by the manager. Your monthly performance statement will display once a package is assigned. Please get in touch with your dashboard administrator.
                </p>
              </div>
            </div>
          ) : selectedCycle ? (
            /* Main cycle view when loaded */
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              
              {/* Row 1: Package & Cycle Earnings Summary */}
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
                    <h4 style={{ fontSize: "1.2rem", margin: 0, fontWeight: 700 }}>Package Details: {activePlan.name}</h4>
                  </div>

                  <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Your targets are evaluated every 30 days starting from your assignment date. Hitting higher tiers unlocks extra bonuses.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-light)", fontWeight: 550, textTransform: "uppercase" }}>Base Count</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.2rem" }}>{activePlan.baseCount} trees</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-light)", fontWeight: 550, textTransform: "uppercase" }}>Base Salary</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#06d6a0", marginTop: "0.2rem" }}>₹{activePlan.baseSalary.toLocaleString()}</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-light)", fontWeight: 550, textTransform: "uppercase" }}>Push Target</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.2rem" }}>{activePlan.pushCount} trees</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.15)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-light)", fontWeight: 550, textTransform: "uppercase" }}>Incentive Rate</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)", marginTop: "0.2rem" }}>₹{activePlan.incentive} / tree</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255,255,255,0.02)", padding: "0.85rem 1rem", borderRadius: "10px", marginTop: "1.25rem", border: "1px dashed var(--surface-border)" }}>
                    <Info size={18} color="var(--primary-hover)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Reaching the <strong>{activePlan.pushCount}</strong> push target awards you the incentive of <strong>₹{activePlan.incentive}</strong> for <em>all</em> harvested trees up to 600 (a ₹{(activePlan.pushCount * activePlan.incentive).toLocaleString()} bonus), plus ₹{activePlan.incentive} for each tree above that!
                    </div>
                  </div>
                </div>

                {/* Cycle Statement Card */}
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
                      <span style={{ fontSize: "0.85rem", color: "white", fontWeight: 600 }}>
                        Cycle {selectedCycle.cycleNumber} Statement
                      </span>
                      
                      <div style={{
                        background: selectedCycle.isPaid ? "rgba(16,185,129,0.12)" : selectedCycle.isCompleted ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${selectedCycle.isPaid ? "#10b981" : selectedCycle.isCompleted ? "#f59e0b" : "var(--surface-border)"}`,
                        color: selectedCycle.isPaid ? "#10b981" : selectedCycle.isCompleted ? "#f59e0b" : "rgba(255,255,255,0.6)",
                        padding: "0.25rem 0.6rem", borderRadius: "100px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase"
                      }}>
                        {selectedCycle.isPaid ? "Paid" : selectedCycle.isCompleted ? "Pending Payout" : "In Progress"}
                      </div>
                    </div>

                    <h3 style={{ fontSize: "2.5rem", margin: "0 0 1.25rem 0", color: "#10b981", display: "flex", alignItems: "baseline", gap: "0.1rem" }}>
                      <span style={{ fontSize: "1.5rem", fontWeight: 500 }}>₹</span>
                      {(selectedCycle.isPaid && selectedCycle.payoutDetails 
                        ? selectedCycle.payoutDetails.amountPaid 
                        : selectedCycle.totalSalary).toLocaleString()}
                    </h3>

                    {/* Breakdown details */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-light)" }}>Base Salary Earned:</span>
                        <span style={{ color: "white", fontWeight: 600 }}>₹{selectedCycle.baseSalaryEarned.toLocaleString()}</span>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-light)" }}>Incentives Earned:</span>
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                          {selectedCycle.isPaid && selectedCycle.payoutDetails && !selectedCycle.payoutDetails.incentivesIncluded 
                            ? "₹0 (Excluded)" 
                            : `+ ₹${selectedCycle.incentivesEarned.toLocaleString()}`}
                        </span>
                      </div>
                      
                      {selectedCycle.isPaid && selectedCycle.payoutDetails && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.6rem", background: "rgba(0,0,0,0.15)", borderRadius: "8px", marginTop: "0.4rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-light)" }}>
                            <span>Paid On:</span>
                            <span style={{ color: "white" }}>{selectedCycle.payoutDetails.paidAt.split("T")[0]}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-light)" }}>
                            <span>Method:</span>
                            <span style={{ color: "white" }}>{selectedCycle.payoutDetails.paymentMethod}</span>
                          </div>
                          {selectedCycle.payoutDetails.receiverName && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-light)" }}>
                              <span>Received By:</span>
                              <span style={{ color: "white" }}>{selectedCycle.payoutDetails.receiverName}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-light)", fontSize: "0.78rem", marginTop: "1rem" }}>
                    <Calendar size={14} />
                    <span>Period: {selectedCycle.startDate} to {selectedCycle.endDate}</span>
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
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: selectedCycle.treesHarvested >= activePlan.baseCount ? "#06d6a0" : "rgba(255,255,255,0.6)" }}>
                        {selectedCycle.treesHarvested} / {activePlan.baseCount} trees
                        {selectedCycle.treesHarvested >= activePlan.baseCount && " (Met)"}
                      </span>
                    </div>

                    <div style={{ height: "10px", background: "rgba(0,0,0,0.3)", borderRadius: "100px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{
                        height: "100%",
                        width: `${progressPercent.basePercent}%`,
                        background: selectedCycle.treesHarvested >= activePlan.baseCount 
                          ? "linear-gradient(90deg, var(--primary) 0%, #10b981 100%)" 
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
                        {selectedCycle.treesHarvested >= activePlan.pushCount && <Sparkles size={14} color="#06d6a0" />}
                      </span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: selectedCycle.treesHarvested >= activePlan.pushCount ? "#06d6a0" : "rgba(255,255,255,0.6)" }}>
                        {selectedCycle.treesHarvested >= activePlan.baseCount 
                          ? `${selectedCycle.treesHarvested} / ${activePlan.pushCount} trees` 
                          : `Complete Base First`}
                        {selectedCycle.treesHarvested >= activePlan.pushCount && " (Max Bonus Activated!)"}
                      </span>
                    </div>

                    <div style={{ height: "10px", background: "rgba(0,0,0,0.3)", borderRadius: "100px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{
                        height: "100%",
                        width: `${progressPercent.pushPercent}%`,
                        background: selectedCycle.treesHarvested >= activePlan.pushCount 
                          ? "linear-gradient(90deg, var(--accent) 0%, #10b981 100%)" 
                          : "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)",
                        borderRadius: "100px",
                        opacity: selectedCycle.treesHarvested >= activePlan.baseCount ? 1 : 0.25,
                        transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Cycle Completed Jobs Log */}
              <div style={{
                background: "var(--surface)",
                borderRadius: "16px",
                border: "1px solid var(--surface-border)",
                overflow: "hidden"
              }}>
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ fontSize: "1.1rem", margin: 0, fontWeight: 700 }}>Cycle Work History</h4>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>Only completed/archived jobs are calculated</span>
                </div>

                {jobsLoading ? (
                  <SkeletonTable rows={4} cols={5} />
                ) : selectedCycle.cycleJobs.length === 0 ? (
                  <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-light)", fontSize: "0.9rem" }}>
                    No job assignments logged during this 30-day cycle.
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
                        {selectedCycle.cycleJobs.map((job) => {
                          const myRecord = job.assignedWorkers?.find(w => w.uid === currentUid);
                          const isJobCompleted = job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED";
                          const harvestCount = myRecord?.harvestedTrees || 0;
                          const isConfirmed = myRecord?.harvestConfirmed || false;

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
                                    ? { background: "rgba(16,185,129,0.1)", color: "#10b981" }
                                    : { background: "rgba(245,158,11,0.1)", color: "#f59e0b" })
                                }}>
                                  {isJobCompleted ? "Completed" : "In Progress"}
                                </span>
                              </td>
                              <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.88rem", fontWeight: 700 }}>
                                {isJobCompleted ? (
                                  isConfirmed ? (
                                    <span style={{ color: "#10b981" }}>{harvestCount} trees</span>
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
          ) : null}
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 1150px) {
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
