"use client";

import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import { db, auth } from "@/lib/firebase";
import { 
  collection, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { 
  IndianRupee, Calendar, Users, CheckCircle, Clock, 
  Search, Download, CreditCard, X, AlertCircle, Filter, 
  ArrowRight, TreePine, Sparkles, CheckCircle2, DollarSign, Trash2
} from "lucide-react";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";

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

interface WorkerUser {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  planId?: string | null;
  planAssignedAt?: string | null;
  createdAt?: string;
}

interface Payout {
  id: string;
  workerUid: string;
  workerName: string;
  planId: string;
  planName: string;
  cycleNumber: number;
  startDate: string;
  endDate: string;
  treesHarvested: number;
  baseSalaryEarned: number;
  incentivesEarned: number;
  incentivesIncluded: boolean;
  amountPaid: number;
  paidAt: string;
  paymentMethod: "CASH" | "GPAY" | "BANK_TRANSFER";
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

interface WorkerWithCycles {
  worker: WorkerUser;
  activePlan: SalaryPlan | null;
  cycles: CalculatedCycle[];
}

export default function FinanceSalary() {
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [currentUserRole, setCurrentUserRole] = useState<string>("finance");
  const [currentUserName, setCurrentUserName] = useState<string>("Finance Manager");
  const [currentUserUid, setCurrentUserUid] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "active" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Firebase Collections State
  const [workers, setWorkers] = useState<WorkerUser[]>([]);
  const [plans, setPlans] = useState<SalaryPlan[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  // Payout Modal State
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedWorkerData, setSelectedWorkerData] = useState<WorkerUser | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<CalculatedCycle | null>(null);
  
  // Payout Form State
  const [includeIncentives, setIncludeIncentives] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "GPAY" | "BANK_TRANSFER">("CASH");
  const [receiverName, setReceiverName] = useState("");
  const [notes, setNotes] = useState("");
  const [changePlanOption, setChangePlanOption] = useState<"continue" | "change">("continue");
  const [nextPlanId, setNextPlanId] = useState<string>("");
  const [salaryHistoryClearedAt, setSalaryHistoryClearedAt] = useState<string>("");
  const [showClearHistoryModal, setShowClearHistoryModal] = useState<boolean>(false);
  const [clearingHistory, setClearingHistory] = useState<boolean>(false);

  // Auth synchronization
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role || "";
        if (!role.toUpperCase().includes("FINANCE")) {
          router.replace(`/dashboard/${role.toLowerCase()}`);
        } else {
          setCurrentUserRole(role);
          setCurrentUserName(userDoc.data().name || "Finance Manager");
          setCurrentUserUid(user.uid);
          setSalaryHistoryClearedAt(userDoc.data().salaryHistoryClearedAt || "");
        }
      }
    });
    return () => unsubAuth();
  }, [router]);

  // Real-time synchronization of plans, users, jobs
  useEffect(() => {
    setLoading(true);

    const unsubPlans = onSnapshot(collection(db, "plans"), (snap) => {
      const list: SalaryPlan[] = [];
      snap.forEach((d) => list.push({ ...d.data() as SalaryPlan, id: d.id }));
      setPlans(list);
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const list: WorkerUser[] = [];
      snap.forEach((d) => {
        const data = d.data() as WorkerUser;
        if (data.role === "worker") {
          list.push({ ...data, uid: d.id });
        }
      });
      setWorkers(list);
    });

    const unsubJobs = onSnapshot(collection(db, "jobs"), (snap) => {
      const list: Job[] = [];
      snap.forEach((d) => list.push({ ...d.data() as Job, id: d.id }));
      setJobs(list);
    });

    return () => {
      unsubPlans();
      unsubUsers();
      unsubJobs();
    };
  }, []);

  // Real-time synchronization of payouts with cleared filter
  useEffect(() => {
    setLoading(true);
    let q: any = collection(db, "payouts");
    if (salaryHistoryClearedAt) {
      q = query(collection(db, "payouts"), where("paidAt", ">", salaryHistoryClearedAt));
    }
    const unsubPayouts = onSnapshot(q, (snap: any) => {
      const list: Payout[] = [];
      snap.forEach((d: any) => list.push({ ...d.data() as Payout, id: d.id }));
      setPayouts(list);
      setLoading(false);
    }, (error) => {
      console.error("Error loading payouts:", error);
      setLoading(false);
    });
    return () => unsubPayouts();
  }, [salaryHistoryClearedAt]);

  // Cycle Generation Engine: computes cycles recursively from assignment date
  const processedWorkersData = useMemo<WorkerWithCycles[]>(() => {
    return workers.map((worker) => {
      const activePlan = plans.find((p) => p.id === worker.planId) || null;
      
      // The day the 30-day cycles start (starts at planAssignedAt, falls back to profile creation date, then fallback date)
      const startDateStr = worker.planAssignedAt || worker.createdAt || "2026-05-01";
      const start = new Date(startDateStr);
      const now = new Date();
      const cycleDurationMs = 30 * 24 * 60 * 60 * 1000;
      const computedCycles: CalculatedCycle[] = [];

      if (activePlan) {
        let cycleNumber = 1;
        let currentCycleStart = new Date(start);

        // Continue generating cycles up to current date (and always generate the first cycle)
        while (currentCycleStart < now || cycleNumber === 1) {
          const currentCycleEnd = new Date(currentCycleStart.getTime() + cycleDurationMs);
          
          // Filter jobs belonging to this worker that date-fall within this 30-day window
          const cycleJobs = jobs.filter((job) => {
            if (!job.date) return false;
            const jobDate = new Date(job.date);
            const isWithinCycle = jobDate >= currentCycleStart && jobDate < currentCycleEnd;
            if (!isWithinCycle) return false;

            // Must be completed/archived jobs
            const isCompleted = job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED";
            if (!isCompleted) return false;

            const myAssignedRecord = job.assignedWorkers?.find((w) => w.uid === worker.uid);
            return myAssignedRecord && myAssignedRecord.harvestConfirmed && myAssignedRecord.status === "accepted";
          });

          // Compute trees harvested
          const treesHarvested = cycleJobs.reduce((sum, job) => {
            const myAssignedRecord = job.assignedWorkers?.find((w) => w.uid === worker.uid);
            return sum + (myAssignedRecord?.harvestedTrees || 0);
          }, 0);

          // Calculate payment breakdown based on plan thresholds
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

          // Look up payout in firestore records
          const payoutDetails = payouts.find(
            (p) => p.workerUid === worker.uid && p.cycleNumber === cycleNumber
          ) || null;
          const isPaid = !!payoutDetails;
          const isCompleted = currentCycleEnd <= now;

          computedCycles.push({
            cycleNumber,
            startDate: currentCycleStart.toISOString().split("T")[0],
            endDate: currentCycleEnd.toISOString().split("T")[0],
            isCompleted,
            isPaid,
            payoutDetails,
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

          // Do not generate future cycles if the current cycle is in progress
          if (!isCompleted) {
            break;
          }
        }
      }

      // Return reverse order (newest cycles first)
      return {
        worker,
        activePlan,
        cycles: computedCycles.reverse(),
      };
    });
  }, [workers, plans, jobs, payouts]);

  // Aggregate stats across cycles
  const stats = useMemo(() => {
    let totalPaid = 0;
    let pendingCount = 0;
    let activeWorkers = 0;

    processedWorkersData.forEach((wData) => {
      if (wData.activePlan) activeWorkers++;
      
      wData.cycles.forEach((cycle) => {
        if (cycle.isPaid && cycle.payoutDetails) {
          totalPaid += cycle.payoutDetails.amountPaid;
        } else if (cycle.isCompleted && !cycle.isPaid) {
          pendingCount++;
        }
      });
    });

    return { totalPaid, pendingCount, activeWorkers };
  }, [processedWorkersData]);

  // Filtered lists for the tabs
  const filteredList = useMemo(() => {
    return processedWorkersData.filter((item) => {
      const matchSearch = item.worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.worker.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.activePlan?.name.toLowerCase() || "").includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (activeTab === "pending") {
        // Must have completed unpaid cycles
        return item.cycles.some((c) => c.isCompleted && !c.isPaid);
      }
      if (activeTab === "active") {
        // Must have an active plan (and show current active cycle)
        return item.activePlan !== null;
      }
      return true; // "history" shows all matching workers
    });
  }, [processedWorkersData, activeTab, searchQuery]);

  // Flattened list of completed, unpaid cycles for the "Pending" tab
  const pendingPayouts = useMemo(() => {
    const list: { worker: WorkerUser; activePlan: SalaryPlan; cycle: CalculatedCycle }[] = [];
    processedWorkersData.forEach((wData) => {
      const activePlan = wData.activePlan;
      if (!activePlan) return;
      wData.cycles.forEach((cycle) => {
        if (cycle.isCompleted && !cycle.isPaid) {
          list.push({
            worker: wData.worker,
            activePlan,
            cycle
          });
        }
      });
    });
    // Filter by search
    return list.filter(item => 
      item.worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.activePlan.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [processedWorkersData, searchQuery]);

  // Form submission handler to process and submit payouts
  const handleOpenPayoutModal = (worker: WorkerUser, cycle: CalculatedCycle) => {
    setSelectedWorkerData(worker);
    setSelectedCycle(cycle);
    setIncludeIncentives(true);
    setPaymentMethod("CASH");
    setReceiverName("");
    setNotes("");
    setChangePlanOption("continue");
    setNextPlanId(worker.planId || "");
    setPayoutModalOpen(true);
  };

  const handleProcessPayout = async () => {
    if (!selectedWorkerData || !selectedCycle || !currentUserUid) return;

    if (paymentMethod === "CASH" && !receiverName.trim()) {
      showToast("Receiver name is required for Cash payments.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const baseEarned = selectedCycle.baseSalaryEarned;
      const incEarned = selectedCycle.incentivesEarned;
      const finalPaid = includeIncentives ? (baseEarned + incEarned) : baseEarned;

      const payoutId = `${selectedWorkerData.uid}_cycle_${selectedCycle.cycleNumber}`;
      
      const payoutDocData: any = {
        id: payoutId,
        workerUid: selectedWorkerData.uid,
        workerName: selectedWorkerData.name,
        planId: selectedWorkerData.planId || "",
        planName: selectedCycle.payoutDetails?.planName || plans.find(p => p.id === selectedWorkerData.planId)?.name || "Plan",
        cycleNumber: selectedCycle.cycleNumber,
        startDate: selectedCycle.startDate,
        endDate: selectedCycle.endDate,
        treesHarvested: selectedCycle.treesHarvested,
        baseSalaryEarned: baseEarned,
        incentivesEarned: incEarned,
        incentivesIncluded: includeIncentives,
        amountPaid: finalPaid,
        paidAt: new Date().toISOString(),
        paymentMethod: paymentMethod
      };

      if (paymentMethod === "CASH" && receiverName) {
        payoutDocData.receiverName = receiverName;
      }
      if (notes) {
        payoutDocData.notes = notes;
      }

      // 1. Save record to `payouts` collection
      await setDoc(doc(db, "payouts", payoutId), payoutDocData);

      // 2. Log matching transaction in `expenses` collection for analytics accounting
      const expenseData = {
        type: "Labor",
        description: `Salary Payout - ${selectedWorkerData.name} - Cycle ${selectedCycle.cycleNumber} (Includes Incentives: ${includeIncentives ? "Yes" : "No"})`,
        amount: finalPaid,
        date: new Date().toISOString().slice(0, 10),
        addedBy: currentUserUid,
        addedByName: currentUserName,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "expenses"), expenseData);

      // 3. Update worker plan assignment if user chose to change it
      if (changePlanOption === "change" && nextPlanId !== selectedWorkerData.planId) {
        await updateDoc(doc(db, "users", selectedWorkerData.uid), {
          planId: nextPlanId || null,
          planAssignedAt: selectedCycle.endDate
        });
      }

      showToast(`Payout of ₹${finalPaid.toLocaleString()} processed successfully for ${selectedWorkerData.name}.`, "success");
      setPayoutModalOpen(false);
    } catch (error: any) {
      console.error("Payout processing error:", error);
      showToast(error.message || "Failed to log salary payout in database.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayout = async (payoutId: string, workerName: string) => {
    const isConfirmed = await confirm({
      title: "Delete Payout Record?",
      message: `Are you sure you want to delete the payout record for "${workerName}"? This will permanently remove the record and return the cycle to Pending Payouts.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });

    if (!isConfirmed) return;

    try {
      await deleteDoc(doc(db, "payouts", payoutId));
      showToast("Payout record deleted successfully.", "success");
    } catch (error: any) {
      console.error("Error deleting payout record:", error);
      showToast(error.message || "Failed to delete payout record.", "error");
    }
  };

  const handleConfirmClearPayoutHistory = async () => {
    setClearingHistory(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user");

      const newClearedAt = new Date().toISOString();
      await updateDoc(doc(db, "users", user.uid), {
        salaryHistoryClearedAt: newClearedAt
      });

      setSalaryHistoryClearedAt(newClearedAt);
      setPayouts([]);
      setShowClearHistoryModal(false);
      showToast("Payout history cleared from active view.", "success");
    } catch (error: any) {
      console.error("Error clearing history:", error);
      showToast(error.message || "Failed to clear history.", "error");
    } finally {
      setClearingHistory(false);
    }
  };

  // Salary Spreadsheet Export Generator
  const handleExportSalarySheet = () => {
    let csv = "Worker Name,Email,Phone,Active Plan,Cycle Number,Cycle Start,Cycle End,Trees Harvested,Base Salary,Incentives,Payment Status,Amount Paid,Paid Date,Payment Method,Receiver/Notes\r\n";
    
    processedWorkersData.forEach((wData) => {
      const worker = wData.worker;
      const planName = wData.activePlan?.name || "No Plan";
      
      if (wData.cycles.length === 0) {
        csv += `"${worker.name}","${worker.email}","${worker.phone}","${planName}","N/A","N/A","N/A",0,0,0,"No Active Period",0,"N/A","N/A",""\r\n`;
      } else {
        wData.cycles.forEach((cycle) => {
          const status = cycle.isPaid ? "PAID" : cycle.isCompleted ? "PENDING" : "IN PROGRESS";
          const amtPaid = cycle.isPaid && cycle.payoutDetails ? cycle.payoutDetails.amountPaid : 0;
          const paidAt = cycle.isPaid && cycle.payoutDetails ? cycle.payoutDetails.paidAt.split("T")[0] : "N/A";
          const method = cycle.isPaid && cycle.payoutDetails ? cycle.payoutDetails.paymentMethod : "N/A";
          const noteStr = cycle.isPaid && cycle.payoutDetails ? (cycle.payoutDetails.notes || cycle.payoutDetails.receiverName || "") : "";
          
          csv += `"${worker.name}","${worker.email}","${worker.phone}","${planName}",${cycle.cycleNumber},${cycle.startDate},${cycle.endDate},${cycle.treesHarvested},${cycle.baseSalaryEarned},${cycle.incentivesEarned},"${status}",${amtPaid},"${paidAt}","${method}","${noteStr}"\r\n`;
        });
      }
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Worker_Salary_Sheet_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Worker salary statement sheet downloaded successfully.", "success");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        <TopBar title="Worker Salary Management" />

        <div style={{ padding: "2.5rem", flex: 1, maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
          
          {/* Dashboard Header */}
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
            <div>
              <h2 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Salary Cycle & Payouts</h2>
              <p style={{ color: "var(--text-muted)", margin: 0 }}>
                Manage workers' 30-day salary periods, calculate performance incentives, and record disbursements.
              </p>
            </div>
            
            <button 
              onClick={handleExportSalarySheet}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem",
                background: "var(--surface-2)",
                border: "1px solid var(--surface-border)",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--surface-2)"}
            >
              <Download size={16} color="var(--accent)" />
              Export Salary Sheet
            </button>
          </div>

          {/* Stats KPI Overview */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
            <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px", 
                background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <IndianRupee size={22} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Total Disbursed</div>
                <h3 style={{ fontSize: "1.75rem", margin: "0.2rem 0 0 0", color: "#10b981", fontWeight: 700 }}>₹{stats.totalPaid.toLocaleString()}</h3>
              </div>
            </div>

            <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px", 
                background: "rgba(212, 163, 115, 0.12)", border: "1px solid rgba(212, 163, 115, 0.25)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Clock size={22} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Pending Approvals</div>
                <h3 style={{ fontSize: "1.75rem", margin: "0.2rem 0 0 0", color: "var(--accent)", fontWeight: 700 }}>{stats.pendingCount} cycles</h3>
              </div>
            </div>

            <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px", 
                background: "var(--primary-glow)", border: "1px solid var(--primary-glow-border)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Users size={22} color="var(--primary-hover)" />
              </div>
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Salaried Workers</div>
                <h3 style={{ fontSize: "1.75rem", margin: "0.2rem 0 0 0", color: "white", fontWeight: 700 }}>{stats.activeWorkers} active</h3>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem" }}>
            {/* Tabs */}
            <div style={{
              display: "inline-flex",
              background: "var(--surface-1)",
              border: "1px solid var(--surface-border)",
              padding: "0.25rem",
              borderRadius: "10px",
              backdropFilter: "blur(8px)"
            }}>
              {[
                { id: "pending", label: `Pending Payouts (${stats.pendingCount})` },
                { id: "active", label: "Active Cycles" },
                { id: "history", label: "Payout History" }
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: "0.6rem 1.25rem",
                    background: activeTab === tab.id ? "var(--primary-glow)" : "transparent",
                    color: activeTab === tab.id ? "var(--primary-hover)" : "var(--text-muted)",
                    border: `1px solid ${activeTab === tab.id ? "var(--primary-glow-border)" : "transparent"}`,
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input & Action Buttons */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", width: "100%", maxWidth: "480px", justifyContent: "flex-end" }}>
              {activeTab === "history" && payouts.length > 0 && (
                <button
                  onClick={() => setShowClearHistoryModal(true)}
                  style={{
                    padding: "0.6rem 1.2rem",
                    background: "rgba(239, 35, 60, 0.12)",
                    color: "var(--error)",
                    border: "1px solid rgba(239, 35, 60, 0.35)",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                    width: "auto"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--error)";
                    e.currentTarget.style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239, 35, 60, 0.12)";
                    e.currentTarget.style.color = "var(--error)";
                  }}
                >
                  Clear History
                </button>
              )}
              <div style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
                <Search size={16} color="var(--text-light)" style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)" }} />
                <input 
                  type="text"
                  placeholder="Search worker or package..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem 1rem 0.65rem 2.5rem",
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "8px",
                    color: "white",
                    fontSize: "0.9rem",
                    outline: "none",
                    fontFamily: "inherit"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Main Dashboard Section */}
          {loading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : activeTab === "pending" ? (
            /* Pending Payouts Tab View */
            pendingPayouts.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                height: "350px", background: "rgba(13, 6, 40, 0.5)", backdropFilter: "blur(12px)",
                borderRadius: "16px", border: "1px dashed var(--surface-border)", color: "rgba(255,255,255,0.4)", gap: "1rem"
              }}>
                <CheckCircle2 size={48} strokeWidth={1} style={{ color: "#10b981" }} />
                <div>
                  <h4 style={{ color: "white", fontWeight: 700, margin: "0 0 0.25rem 0", textAlign: "center" }}>All Clear!</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>There are no completed worker cycles awaiting payout approval.</p>
                </div>
              </div>
            ) : (
              <div className="scroll-table-container" style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--surface-border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(0,0,0,0.2)" }}>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Worker</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Active Plan</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Cycle Details</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Harvest Performance</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Pending Dues</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPayouts.map(({ worker, activePlan, cycle }) => (
                      <tr key={`${worker.uid}_${cycle.cycleNumber}`} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "1rem 1.5rem" }}>
                          <div style={{ fontWeight: 600, color: "white" }}>{worker.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{worker.phone}</div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem" }}>
                          <div style={{ fontWeight: 550 }}>{activePlan.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>Base count: {activePlan.baseCount} trees</div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem" }}>
                          <div style={{ fontWeight: 550 }}>Cycle {cycle.cycleNumber}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{cycle.startDate} to {cycle.endDate}</div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "white" }}>{cycle.treesHarvested} trees</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
                            {cycle.tier === "push-achieved" ? "🔥 Push Target Met" : cycle.tier === "base-achieved" ? "✓ Base Met" : "Prorated Pay"}
                          </div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "#10b981", fontSize: "0.95rem" }}>₹{cycle.totalSalary.toLocaleString()}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>
                            Base: ₹{cycle.baseSalaryEarned.toLocaleString()} | Inc: ₹{cycle.incentivesEarned.toLocaleString()}
                          </div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
                          <button
                            onClick={() => handleOpenPayoutModal(worker, cycle)}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              cursor: "pointer",
                              transition: "opacity 0.2s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                          >
                            Pay Salary
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === "active" ? (
            /* Active Worker Cycles Tab View */
            filteredList.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                No active worker packages match your query.
              </div>
            ) : (
              <div className="scroll-table-container" style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--surface-border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(0,0,0,0.2)" }}>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Worker</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Assigned Package</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Current Cycle</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Trees Harvested</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Accrued Pay</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Time Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map(({ worker, activePlan, cycles }) => {
                      // The active in-progress cycle is the first one in list (or fallback check)
                      const currentCycle = cycles.find(c => !c.isCompleted) || cycles[0];
                      if (!currentCycle) return null;

                      // Progress percentage for 30-day cycle visual representation
                      const daysPassed = 30 - currentCycle.daysRemaining;
                      const percent = Math.min((daysPassed / 30) * 100, 100);

                      return (
                        <tr key={worker.uid} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "1rem 1.5rem" }}>
                            <div style={{ fontWeight: 600, color: "white" }}>{worker.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{worker.email}</div>
                          </td>
                          <td style={{ padding: "1rem 1.5rem" }}>
                            <div style={{ fontWeight: 550 }}>{activePlan?.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>₹{activePlan?.baseSalary.toLocaleString()} base pay</div>
                          </td>
                          <td style={{ padding: "1rem 1.5rem" }}>
                            <div style={{ fontWeight: 550 }}>Cycle {currentCycle.cycleNumber}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{currentCycle.startDate} to {currentCycle.endDate}</div>
                          </td>
                          <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                            <div style={{ fontWeight: 700, color: "white" }}>{currentCycle.treesHarvested} trees</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>Target: {activePlan?.baseCount} base count</div>
                          </td>
                          <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                            <div style={{ fontWeight: 700, color: "var(--accent)" }}>₹{currentCycle.totalSalary.toLocaleString()}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>Accrued Pay</div>
                          </td>
                          <td style={{ padding: "1rem 1.5rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "center" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "white" }}>{currentCycle.daysRemaining} days left</span>
                              
                              {/* Small progress meter */}
                              <div style={{ width: "80px", height: "6px", background: "rgba(0,0,0,0.3)", borderRadius: "100px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ height: "100%", width: `${percent}%`, background: "var(--accent)", borderRadius: "100px" }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Historical Payout Log View */
            payouts.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                No historical payout statements found in the logs.
              </div>
            ) : (
              <div className="scroll-table-container" style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--surface-border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(0,0,0,0.2)" }}>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Worker</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Plan & Cycle</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Disbursement Date</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Trees Harvested</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Amount Paid</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Method</th>
                      <th style={{ padding: "1.2rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "1rem 1.5rem" }}>
                          <div style={{ fontWeight: 600, color: "white" }}>{payout.workerName}</div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem" }}>
                          <div style={{ fontWeight: 550 }}>{payout.planName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>Cycle {payout.cycleNumber} ({payout.startDate} to {payout.endDate})</div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem" }}>
                          <div style={{ fontWeight: 550 }}>{payout.paidAt.split("T")[0]}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{payout.paidAt.split("T")[1].slice(0, 5)}</div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontWeight: 600, color: "white" }}>
                          {payout.treesHarvested} trees
                        </td>
                        <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "#10b981", fontSize: "0.95rem" }}>₹{payout.amountPaid.toLocaleString()}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>
                            {payout.incentivesIncluded ? "Incentives included" : "Base salary only"}
                          </div>
                        </td>
                        <td style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
                          <span style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--surface-border)",
                            color: "white"
                          }}>
                            {payout.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
                          <button
                            onClick={() => handleDeletePayout(payout.id, payout.workerName)}
                            style={{
                              background: "rgba(239,35,60,0.08)",
                              color: "var(--error)",
                              border: "1px solid rgba(239,35,60,0.15)",
                              borderRadius: "6px",
                              width: "28px",
                              height: "28px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--error)";
                              e.currentTarget.style.color = "white";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(239,35,60,0.08)";
                              e.currentTarget.style.color = "var(--error)";
                            }}
                            title="Delete Payout Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </main>

      {/* Payout Processing Dialog Modal */}
      {payoutModalOpen && selectedWorkerData && selectedCycle && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem"
        }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => !submitting && setPayoutModalOpen(false)} />
          
          <div 
            style={{
              position: "relative",
              background: "var(--surface-overlay)",
              backdropFilter: "blur(24px)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%", maxWidth: "550px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              overflow: "hidden"
            }}
          >
            {/* Header */}
            <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.15)" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Process Worker Payout</h3>
                <span style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>Cycle {selectedCycle.cycleNumber} ({selectedCycle.startDate} to {selectedCycle.endDate})</span>
              </div>
              <button 
                onClick={() => setPayoutModalOpen(false)}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem", overflowY: "auto", flex: 1 }}>
              {/* Profile Card */}
              <div style={{ background: "rgba(0,0,0,0.15)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "white", fontSize: "1.1rem" }}>{selectedWorkerData.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>Contact: {selectedWorkerData.phone}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-light)", textTransform: "uppercase", fontWeight: 600 }}>Plan Threshold</div>
                  <div style={{ fontWeight: 600, color: "var(--accent)" }}>{selectedCycle.treesHarvested} trees harvested</div>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderBottom: "1px dashed var(--surface-border)", paddingBottom: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Base Salary:</span>
                  <span style={{ fontWeight: 600, color: "white" }}>₹{selectedCycle.baseSalaryEarned.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Accrued Incentives:</span>
                  <span style={{ fontWeight: 600, color: "var(--accent)" }}>₹{selectedCycle.incentivesEarned.toLocaleString()}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem", padding: "0.5rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <label htmlFor="incentive-checkbox" style={{ fontSize: "0.9rem", color: "white", fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input 
                      id="incentive-checkbox"
                      type="checkbox"
                      checked={includeIncentives}
                      onChange={(e) => setIncludeIncentives(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    Include Performance Incentives
                  </label>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-light)", textTransform: "uppercase" }}>
                    {selectedCycle.tier === "push-achieved" ? "Push mode active" : selectedCycle.tier === "base-achieved" ? "Base met" : "Under Base"}
                  </span>
                </div>
              </div>

              {/* Net Payout Pannel */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "rgba(16,185,129,0.08)", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.25)" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "white", fontSize: "0.85rem", textTransform: "uppercase" }}>Disbursement Value</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-light)", marginTop: "0.15rem" }}>
                    {includeIncentives ? "Base salary + performance bonuses" : "Base salary only (incentives excluded)"}
                  </div>
                </div>
                <h3 style={{ fontSize: "2.2rem", margin: 0, color: "#10b981", fontWeight: 800 }}>
                  ₹{(includeIncentives ? selectedCycle.totalSalary : selectedCycle.baseSalaryEarned).toLocaleString()}
                </h3>
              </div>

              {/* Payment Details Input Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    Payment Method
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {["CASH", "GPAY", "BANK_TRANSFER"].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method as any)}
                        style={{
                          flex: 1, padding: "0.75rem", borderRadius: "8px",
                          background: paymentMethod === method ? "var(--primary-glow)" : "rgba(0,0,0,0.2)",
                          border: `1px solid ${paymentMethod === method ? "var(--primary)" : "var(--surface-border)"}`,
                          color: paymentMethod === method ? "white" : "var(--text-muted)",
                          fontWeight: 650, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s"
                        }}
                      >
                        {method === "GPAY" ? "Google Pay (UPI)" : method.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === "CASH" && (
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                      Receiver Name (Mandatory)
                    </label>
                    <input 
                      type="text"
                      placeholder="Enter name of worker/proxy receiving cash"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      required
                      style={{
                        width: "100%", padding: "0.75rem 1rem",
                        background: "rgba(0,0,0,0.25)", border: "1px solid var(--surface-border)",
                        borderRadius: "8px", color: "white", fontSize: "0.95rem", outline: "none", fontFamily: "inherit"
                      }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    Disbursement Notes (Optional)
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="Reference code, transaction ID, or hand-over notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{
                      width: "100%", padding: "0.75rem 1rem",
                      background: "rgba(0,0,0,0.25)", border: "1px solid var(--surface-border)",
                      borderRadius: "8px", color: "white", fontSize: "0.95rem", outline: "none", resize: "none", fontFamily: "inherit"
                    }}
                  />
                </div>

                {/* Plan for Next Cycle */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    Plan for Next Cycle
                  </label>
                  <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <label style={{
                      flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem",
                      background: changePlanOption === "continue" ? "rgba(16,185,129,0.08)" : "rgba(0,0,0,0.15)",
                      border: `1px solid ${changePlanOption === "continue" ? "#10b981" : "var(--surface-border)"}`,
                      borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", color: "white"
                    }}>
                      <input 
                        type="radio" 
                        name="plan-option" 
                        value="continue" 
                        checked={changePlanOption === "continue"}
                        onChange={() => setChangePlanOption("continue")}
                      />
                      Continue same plan
                    </label>
                    <label style={{
                      flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem",
                      background: changePlanOption === "change" ? "rgba(59, 130, 246, 0.08)" : "rgba(0,0,0,0.15)",
                      border: `1px solid ${changePlanOption === "change" ? "#3b82f6" : "var(--surface-border)"}`,
                      borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", color: "white"
                    }}>
                      <input 
                        type="radio" 
                        name="plan-option" 
                        value="change"
                        checked={changePlanOption === "change"}
                        onChange={() => setChangePlanOption("change")}
                      />
                      Switch package
                    </label>
                  </div>

                  {changePlanOption === "change" && (
                    <select
                      value={nextPlanId}
                      onChange={(e) => setNextPlanId(e.target.value)}
                      style={{
                        width: "100%", padding: "0.75rem 1rem",
                        background: "rgba(0,0,0,0.25)", border: "1px solid var(--surface-border)",
                        borderRadius: "8px", color: "white", fontSize: "0.9rem", outline: "none", fontFamily: "inherit"
                      }}
                    >
                      <option value="" style={{ backgroundColor: "#121218" }}>Unassign Plan</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id} style={{ backgroundColor: "#121218" }}>
                          {p.name} (Base count: {p.baseCount} trees | ₹{p.baseSalary.toLocaleString()} base)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Confirm Submission Action Button */}
              <button 
                onClick={handleProcessPayout}
                disabled={submitting}
                style={{
                  width: "100%", padding: "1rem", marginTop: "0.5rem",
                  background: submitting ? "var(--surface-border)" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white", border: "none", borderRadius: "12px",
                  fontWeight: 700, fontSize: "1rem", cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem"
                }}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
                    Disbursing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Disburse & Close Cycle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Payout History Warning Modal */}
      {showClearHistoryModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem"
        }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => !clearingHistory && setShowClearHistoryModal(false)} />
          
          <div 
            style={{
              position: "relative",
              background: "var(--surface-overlay)",
              backdropFilter: "blur(24px)",
              border: "1px solid var(--surface-border)",
              borderRadius: "20px",
              width: "100%", maxWidth: "480px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              overflow: "hidden"
            }}
          >
            {/* Header */}
            <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.15)" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--error)" }}>Clear Payout History</h3>
              </div>
              <button 
                onClick={() => setShowClearHistoryModal(false)}
                disabled={clearingHistory}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "rgba(239, 35, 60, 0.08)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(239, 35, 60, 0.2)" }}>
                <AlertCircle size={24} style={{ color: "var(--error)", flexShrink: 0, marginTop: "2px" }} />
                <div style={{ fontSize: "0.9rem", color: "var(--text-light)", lineHeight: "1.5" }}>
                  <p style={{ margin: "0 0 0.5rem 0", color: "white", fontWeight: 600 }}>This action cannot be undone locally.</p>
                  Clearing history will archive and hide all existing payout records from the dashboard display to keep it responsive. The raw records will remain in the database for compliance.
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  It is highly recommended that you export the current salary sheet data before clearing the dashboard logs.
                </p>
                <button
                  type="button"
                  onClick={handleExportSalarySheet}
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    background: "var(--surface-2)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "8px",
                    fontWeight: 650,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--surface-2)"}
                >
                  <Download size={16} color="var(--accent)" />
                  Download Salary CSV Sheet
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowClearHistoryModal(false)}
                  disabled={clearingHistory}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearPayoutHistory}
                  disabled={clearingHistory}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: clearingHistory ? "var(--surface-border)" : "var(--error)",
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: clearingHistory ? "not-allowed" : "pointer"
                  }}
                >
                  {clearingHistory ? "Clearing..." : "Clear History"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Animations and Dynamic Micro-interactions */}
      <style dangerouslySetInnerHTML={{ __html: `
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 1150px) {
          .flex-stack-mobile {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1.25rem !important;
          }
        }
      `}} />
    </div>
  );
}
