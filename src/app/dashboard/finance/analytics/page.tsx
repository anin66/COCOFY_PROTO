"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { db, auth } from "@/lib/firebase";
import {
  collection, onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, AlertTriangle,
  MapPin, Users, TreePine, Calendar, Plus, Edit, Trash2, X,
  Download, Eye, ChevronDown, Sparkles, Brain, Target,
  ArrowUpRight, ArrowDownRight, IndianRupee, Loader, RefreshCw,
  Award, Crown, Medal, Star, BarChart3, PieChart, FileText,
  BookOpen, Zap, Lightbulb, ShieldAlert, TrendingUp as Forecast
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import DatePicker from "@/components/ui/DatePicker";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";

/* ============================== TYPES ============================== */
interface Job {
  id: string;
  customerName: string;
  phone: string;
  location: string;
  date: string;
  trees: number;
  workersRequired: number;
  pricePerTree: string;
  status: string;
  createdAt: string;
  time?: string;
  assignedWorkers?: {
    uid: string;
    name: string;
    status: "pending" | "accepted" | "rejected";
    harvestedTrees?: number;
    harvestConfirmed?: boolean;
  }[];
}

interface Payment {
  id: string;
  jobId: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: "FULLY_PAID" | "PARTIALLY_PAID" | "UNPAID";
  jobDetails: Job;
  transactions: { amount: number; method: string; receiverName?: string; date: string; fileUrl?: string }[];
  lastUpdatedAt: string;
}

interface Expense {
  id: string;
  type: string;
  description: string;
  amount: number;
  date: string;
  addedBy: string;
  addedByName: string;
  createdAt: string;
}

interface AIInsight {
  type: "trend" | "warning" | "tip" | "forecast";
  title: string;
  description: string;
}

interface MonthlyDataPoint {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
}

interface LocationStat {
  location: string;
  revenue: number;
  jobs: number;
  trees: number;
}

interface WorkerStat {
  uid: string;
  name: string;
  totalTrees: number;
  totalJobs: number;
  revenue: number;
}

/* ============================== CONSTANTS ============================== */
const EXPENSE_TYPES = [
  "Fuel", "Equipment", "Maintenance", "Transport",
  "Labor", "Office", "Utilities", "Insurance", "Miscellaneous", "Other"
];

const DATE_PRESETS = [
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "3_months", label: "Last 3 Months" },
  { id: "6_months", label: "Last 6 Months" },
  { id: "this_year", label: "This Year" },
  { id: "all_time", label: "All Time" },
] as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

/* ============================== HELPERS ============================== */
const parsePrice = (priceStr: string) => {
  const num = parseInt(priceStr?.replace(/[^0-9]/g, "") || "0");
  return isNaN(num) ? 0 : num;
};

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const fmtFull = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const getMonthKey = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS[parseInt(m) - 1]?.slice(0, 3)} ${y}`;
};

const isInRange = (dateStr: string, from: Date, to: Date) => {
  const d = new Date(dateStr);
  return d >= from && d <= to;
};

const getDateBounds = (preset: string, customFrom?: string, customTo?: string) => {
  const now = new Date();
  let from: Date, to: Date;
  switch (preset) {
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "3_months":
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "6_months":
      from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    case "custom":
      from = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), 0, 1);
      to = customTo ? new Date(customTo + "T23:59:59") : now;
      break;
    default:
      from = new Date(2000, 0, 1);
      to = new Date(2100, 0, 1);
  }
  return { from, to };
};

/* ============================== SVG CHART HELPERS ============================== */
const createSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cpx1 = points[i].x + (points[i + 1].x - points[i].x) / 3;
    const cpy1 = points[i].y;
    const cpx2 = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
    const cpy2 = points[i + 1].y;
    d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${points[i + 1].x} ${points[i + 1].y}`;
  }
  return d;
};

/* ============================== MAIN COMPONENT ============================== */
export default function FinanceAnalytics() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const router = useRouter();
  const [currentUserRole, setCurrentUserRole] = useState("finance");
  const [currentUserName, setCurrentUserName] = useState("Finance Manager");
  const [currentUserUid, setCurrentUserUid] = useState("");
  const [loading, setLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<"analytics" | "ledger">("analytics");

  // Raw Firebase Data
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);

  // Date Range
  const [datePreset, setDatePreset] = useState("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // AI
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Expense Modal
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expType, setExpType] = useState("Fuel");
  const [customExpType, setCustomExpType] = useState("");
  const [allPayouts, setAllPayouts] = useState<any[]>([]);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expSubmitting, setExpSubmitting] = useState(false);

  // Ledger
  const [ledgerPeriodType, setLedgerPeriodType] = useState<"today" | "month" | "year" | "custom">("month");
  const [ledgerTodayDate, setLedgerTodayDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [ledgerMonth, setLedgerMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [ledgerYear, setLedgerYear] = useState(() => {
    const now = new Date();
    return String(now.getFullYear());
  });
  const [ledgerStartDate, setLedgerStartDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [ledgerViewMode, setLedgerViewMode] = useState<"tables" | "consolidated">("tables");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const ledgerPdfRef = useRef<HTMLDivElement | null>(null);

  // Dues reminder states
  const [selectedDueClient, setSelectedDueClient] = useState<string>("");
  const [reminderTemplate, setReminderTemplate] = useState<"friendly" | "formal" | "urgent">("friendly");
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Advanced financial features states
  const [projectionGrowthRate, setProjectionGrowthRate] = useState<number>(0);
  const [fixedCosts, setFixedCosts] = useState<number>(25000);
  const [workerCostPerTreeBE, setWorkerCostPerTreeBE] = useState<number>(15);
  const [pricePerTreeBE, setPricePerTreeBE] = useState<number>(40);
  const [editingBudgets, setEditingBudgets] = useState<boolean>(false);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({
    Fuel: 5000,
    Equipment: 10000,
    Maintenance: 5000,
    Transport: 8000,
    Labor: 25000,
    Office: 5000,
    Utilities: 3000,
    Insurance: 4000,
    Miscellaneous: 3000,
    Other: 2000,
  });

  // Animated counters
  const [animatedRevenue, setAnimatedRevenue] = useState(0);
  const [animatedExpenses, setAnimatedExpenses] = useState(0);
  const [animatedProfit, setAnimatedProfit] = useState(0);
  const [animatedDue, setAnimatedDue] = useState(0);

  /* ============================== AUTH ============================== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace("/login"); return; }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role || "";
        if (!role.toUpperCase().includes("FINANCE")) {
          router.replace(`/dashboard/${role.toLowerCase()}`);
        } else {
          setCurrentUserRole(role);
          setCurrentUserName(userDoc.data().name || "Finance Manager");
          setCurrentUserUid(user.uid);
        }
      }
    });
    return () => unsub();
  }, [router]);

  /* ============================== FIREBASE LISTENERS ============================== */
  useEffect(() => {
    const unsubJobs = onSnapshot(collection(db, "jobs"), (snap) => {
      const list: Job[] = [];
      snap.forEach((d) => list.push({ ...d.data() as Job, id: d.id }));
      setAllJobs(list);
    });

    const unsubPayments = onSnapshot(collection(db, "payments"), (snap) => {
      const list: Payment[] = [];
      snap.forEach((d) => list.push({ ...d.data() as Payment, id: d.id }));
      setAllPayments(list);
    });

    const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
      const list: Expense[] = [];
      snap.forEach((d) => list.push({ ...d.data() as Expense, id: d.id }));
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllExpenses(list);
      setLoading(false);
    });

    const unsubPayouts = onSnapshot(collection(db, "payouts"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id }));
      setAllPayouts(list);
    });

    return () => { unsubJobs(); unsubPayments(); unsubExpenses(); unsubPayouts(); };
  }, []);

  /* ============================== FILTERED DATA ============================== */
  const { from: rangeFrom, to: rangeTo } = useMemo(
    () => getDateBounds(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  );

  const filteredPayments = useMemo(
    () => allPayments.filter((p) => isInRange(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt, rangeFrom, rangeTo)),
    [allPayments, rangeFrom, rangeTo]
  );

  const filteredExpenses = useMemo(
    () => allExpenses.filter((e) => isInRange(e.date, rangeFrom, rangeTo)),
    [allExpenses, rangeFrom, rangeTo]
  );

  const filteredJobs = useMemo(() => {
    return allJobs
      .filter((j) => isInRange(j.date || j.createdAt, rangeFrom, rangeTo))
      .map((job) => {
        let totalHarvested = 0;
        let hasHarvestedData = false;
        job.assignedWorkers?.forEach((w) => {
          if (w.status === "accepted" && w.harvestConfirmed) {
            totalHarvested += w.harvestedTrees || 0;
            hasHarvestedData = true;
          }
        });
        const actualTrees = hasHarvestedData ? totalHarvested : (job.trees || 0);
        return {
          ...job,
          trees: actualTrees
        };
      });
  }, [allJobs, rangeFrom, rangeTo]);

  /* ============================== KPI CALCULATIONS ============================== */
  const totalRevenue = useMemo(
    () => filteredPayments.filter((p) => p.paymentStatus === "FULLY_PAID").reduce((s, p) => s + (p.totalAmount || 0), 0),
    [filteredPayments]
  );

  const totalWorkerCost = useMemo(() => {
    let cost = 0;
    filteredJobs.forEach((job) => {
      let totalHarvested = 0;
      let hasHarvestedData = false;
      job.assignedWorkers?.forEach((w) => {
        if (w.status === "accepted" && w.harvestConfirmed) {
          totalHarvested += w.harvestedTrees || 0;
          hasHarvestedData = true;
        }
      });
      const actualTrees = hasHarvestedData ? totalHarvested : (job.trees || 0);
      cost += actualTrees * workerCostPerTreeBE;
    });
    return cost;
  }, [filteredJobs, workerCostPerTreeBE]);

  const totalExpensesAmt = useMemo(
    () => filteredExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  );

  const netProfit = totalRevenue - totalExpensesAmt;

  const totalDue = useMemo(
    () => filteredPayments.filter((p) => p.paymentStatus === "UNPAID" || p.paymentStatus === "PARTIALLY_PAID").reduce((s, p) => s + (p.dueAmount || 0), 0),
    [filteredPayments]
  );

  // Previous period for % change
  const prevBounds = useMemo(() => {
    const diff = rangeTo.getTime() - rangeFrom.getTime();
    return { from: new Date(rangeFrom.getTime() - diff), to: new Date(rangeFrom.getTime() - 1) };
  }, [rangeFrom, rangeTo]);

  const prevRevenue = useMemo(
    () => allPayments.filter((p) => p.paymentStatus === "FULLY_PAID" && isInRange(p.lastUpdatedAt || p.jobDetails?.date, prevBounds.from, prevBounds.to)).reduce((s, p) => s + (p.totalAmount || 0), 0),
    [allPayments, prevBounds]
  );

  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  /* ============================== ANIMATED COUNTERS ============================== */
  useEffect(() => {
    const dur = 1200;
    const fps = 60;
    const steps = dur / (1000 / fps);
    let step = 0;
    const targets = [totalRevenue, totalExpensesAmt, netProfit, totalDue];
    const setters = [setAnimatedRevenue, setAnimatedExpenses, setAnimatedProfit, setAnimatedDue];
    const interval = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setters.forEach((set, i) => set(Math.round(targets[i] * ease)));
      if (step >= steps) clearInterval(interval);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [totalRevenue, totalExpensesAmt, netProfit, totalDue]);

  /* ============================== MONTHLY CHART DATA ============================== */
  const monthlyData = useMemo(() => {
    const map = new Map<string, MonthlyDataPoint>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, { month: key, label: getMonthLabel(key), revenue: 0, expenses: 0 });
    }
    allPayments.filter((p) => p.paymentStatus === "FULLY_PAID").forEach((p) => {
      const key = getMonthKey(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt);
      if (map.has(key)) map.get(key)!.revenue += p.totalAmount || 0;
    });
    allExpenses.forEach((e) => {
      const key = getMonthKey(e.date);
      if (map.has(key)) map.get(key)!.expenses += e.amount;
    });
    return Array.from(map.values());
  }, [allPayments, allExpenses]);

  /* ============================== INTERACTIVE PROJECTIONS & FORECASTER ============================== */
  const forecastLinear = (data: number[], steps: number) => {
    const n = data.length;
    if (n === 0) return Array(steps).fill(0);
    if (n === 1) return Array(steps).fill(data[0]);
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const results = [];
    for (let i = 0; i < steps; i++) {
      const val = slope * (n + i) + intercept;
      results.push(Math.max(0, Math.round(val)));
    }
    return results;
  };

  const projectionsData = useMemo(() => {
    const revs = monthlyData.map((d) => d.revenue);
    const exps = monthlyData.map((d) => d.expenses);
    const steps = 3;
    const fRevs = forecastLinear(revs, steps);
    const fExps = forecastLinear(exps, steps);

    const now = new Date();
    const projections = [];
    for (let i = 0; i < steps; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
      const label = `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
      const revRaw = fRevs[i] || 0;
      const revAdj = Math.round(revRaw * (1 + projectionGrowthRate / 100));
      const expVal = fExps[i] || 0;
      projections.push({
        label,
        revenue: revAdj,
        expenses: expVal,
        profit: revAdj - expVal,
      });
    }
    return projections;
  }, [monthlyData, projectionGrowthRate]);

  /* ============================== BUDGET VS ACTUAL PLANNER ============================== */
  const categoryExpenses = useMemo(() => {
    const map: Record<string, number> = {};
    EXPENSE_TYPES.forEach((t) => { map[t] = 0; });
    filteredExpenses.forEach((e) => {
      const type = e.type || "Other";
      if (map[type] !== undefined) {
        map[type] += e.amount;
      } else {
        map["Other"] = (map["Other"] || 0) + e.amount;
      }
    });
    return map;
  }, [filteredExpenses]);

  /* ============================== OUTSTANDING DUES AGING & VELOCITY ============================== */
  const agingDuesData = useMemo(() => {
    const now = new Date();
    let bucket1 = 0, bucket1Amt = 0; // 0-7 days
    let bucket2 = 0, bucket2Amt = 0; // 8-30 days
    let bucket3 = 0, bucket3Amt = 0; // 31+ days

    const dueList = allPayments.filter((p) => p.paymentStatus === "UNPAID" || p.paymentStatus === "PARTIALLY_PAID");

    dueList.forEach((p) => {
      const jobDateStr = p.jobDetails?.date || p.jobDetails?.createdAt || p.lastUpdatedAt;
      const jobDate = new Date(jobDateStr);
      const diffTime = Math.abs(now.getTime() - jobDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const due = p.dueAmount || 0;
      if (diffDays <= 7) {
        bucket1++;
        bucket1Amt += due;
      } else if (diffDays <= 30) {
        bucket2++;
        bucket2Amt += due;
      } else {
        bucket3++;
        bucket3Amt += due;
      }
    });

    // Average collection velocity (days to settle fully paid payments)
    const settledPayments = allPayments.filter((p) => p.paymentStatus === "FULLY_PAID" && p.lastUpdatedAt);
    let totalSettleDays = 0;
    settledPayments.forEach((p) => {
      const jobDateStr = p.jobDetails?.date || p.jobDetails?.createdAt;
      const jobDate = new Date(jobDateStr);
      const settleDate = new Date(p.lastUpdatedAt);
      const diffTime = settleDate.getTime() - jobDate.getTime();
      const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      totalSettleDays += diffDays;
    });

    const avgVelocity = settledPayments.length > 0 ? Math.round(totalSettleDays / settledPayments.length) : 0;

    return {
      bucket1, bucket1Amt,
      bucket2, bucket2Amt,
      bucket3, bucket3Amt,
      avgVelocity,
      dueList
    };
  }, [allPayments]);

  /* ============================== LOCATION PROFITABILITY ANALYSIS ============================== */
  const locationProfitability = useMemo(() => {
    const map = new Map<string, { location: string; revenue: number; jobs: number; trees: number; workerCost: number; profit: number; margin: number }>();
    
    // Group all jobs by location to sum trees and calculate worker cost
    filteredJobs.forEach((job) => {
      const loc = job.location || "Unknown";
      if (!map.has(loc)) {
        map.set(loc, { location: loc, revenue: 0, jobs: 0, trees: 0, workerCost: 0, profit: 0, margin: 0 });
      }
      const s = map.get(loc)!;
      s.jobs += 1;

      // Calculate actual worker cost based on harvested trees (only if paid in completed cycle, otherwise ₹0)
      let totalHarvested = 0;
      let hasHarvestedData = false;
      job.assignedWorkers?.forEach((w) => {
        if (w.status === "accepted" && w.harvestConfirmed) {
          // Check if this worker has a payout cycle that covers this job date
          const isPaid = allPayouts.some((payout) => {
            if (payout.workerUid !== w.uid) return false;
            const jobDateStr = job.date || job.createdAt;
            if (!jobDateStr) return false;
            
            const jDate = new Date(jobDateStr.slice(0, 10));
            const pStart = new Date(payout.startDate.slice(0, 10));
            const pEnd = new Date(payout.endDate.slice(0, 10));
            
            return jDate >= pStart && jDate <= pEnd;
          });

          if (isPaid) {
            totalHarvested += w.harvestedTrees || 0;
            hasHarvestedData = true;
          }
        }
      });

      const actualTrees = hasHarvestedData ? totalHarvested : 0;
      s.trees += actualTrees;
      s.workerCost += actualTrees * workerCostPerTreeBE;
    });

    // Group revenues from fully paid payments by location
    filteredPayments.filter((p) => p.paymentStatus === "FULLY_PAID").forEach((p) => {
      const loc = p.jobDetails?.location || "Unknown";
      const s = map.get(loc);
      if (s) {
        s.revenue += p.totalAmount || 0;
      }
    });

    // Compute profitability metrics
    const list = Array.from(map.values()).map((s) => {
      const profit = s.revenue - s.workerCost;
      const margin = s.revenue > 0 ? Math.round((profit / s.revenue) * 100) : 0;
      return {
        ...s,
        profit,
        margin
      };
    });

    // Sort by profit margin descending, then profit amount
    return list.sort((a, b) => b.margin - a.margin || b.profit - a.profit);
  }, [filteredJobs, filteredPayments, workerCostPerTreeBE, allPayouts]);

  /* ============================== LOCATION STATS ============================== */
  const locationStats = useMemo(() => {
    const map = new Map<string, LocationStat>();
    filteredPayments.filter((p) => p.paymentStatus === "FULLY_PAID").forEach((p) => {
      const loc = p.jobDetails?.location || "Unknown";
      if (!map.has(loc)) map.set(loc, { location: loc, revenue: 0, jobs: 0, trees: 0 });
      const s = map.get(loc)!;
      s.revenue += p.totalAmount || 0;
      s.jobs += 1;
      s.trees += p.jobDetails?.trees || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filteredPayments]);

  /* ============================== WORKER STATS ============================== */
  const workerStats = useMemo(() => {
    const map = new Map<string, WorkerStat>();
    filteredJobs.forEach((job) => {
      const ppt = parsePrice(job.pricePerTree);
      job.assignedWorkers?.filter((w) => w.status === "accepted" && w.harvestConfirmed).forEach((w) => {
        if (!map.has(w.uid)) map.set(w.uid, { uid: w.uid, name: w.name, totalTrees: 0, totalJobs: 0, revenue: 0 });
        const s = map.get(w.uid)!;
        s.totalTrees += w.harvestedTrees || 0;
        s.totalJobs += 1;
        s.revenue += (w.harvestedTrees || 0) * ppt;
      });
    });
    return Array.from(map.values()).sort((a, b) => b.totalTrees - a.totalTrees).slice(0, 5);
  }, [filteredJobs]);

  /* ============================== PAYMENT STATUS BREAKDOWN ============================== */
  const paymentBreakdown = useMemo(() => {
    let paid = 0, partial = 0, unpaid = 0;
    filteredPayments.forEach((p) => {
      if (p.paymentStatus === "FULLY_PAID") paid += p.totalAmount || 0;
      else if (p.paymentStatus === "PARTIALLY_PAID") partial += p.totalAmount || 0;
      else unpaid += p.totalAmount || 0;
    });
    return { paid, partial, unpaid, total: paid + partial + unpaid };
  }, [filteredPayments]);

  /* ============================== AI INSIGHTS (GEMINI) ============================== */
  const generateAIInsights = useCallback(async () => {
    if (!GEMINI_API_KEY) return;
    setAiLoading(true);
    try {
      const topLocs = locationStats.slice(0, 3).map((l) => `${l.location} (₹${l.revenue})`).join(", ");
      const topWorkers = workerStats.slice(0, 3).map((w) => `${w.name} (${w.totalTrees} trees)`).join(", ");

      const prompt = `You are a senior financial data analyst for "Cocofy", a coconut tree harvesting service company in India. Analyze the following real financial data and provide exactly 6 actionable business insights. Be specific with numbers and percentages. Use Indian Rupee (₹).

FINANCIAL DATA:
- Revenue this period: ₹${totalRevenue.toLocaleString("en-IN")}
- Revenue previous period: ₹${prevRevenue.toLocaleString("en-IN")}
- Revenue change: ${revenueChange.toFixed(1)}%
- Total expenses: ₹${totalExpensesAmt.toLocaleString("en-IN")}
- Net profit: ₹${netProfit.toLocaleString("en-IN")}
- Total outstanding dues: ₹${totalDue.toLocaleString("en-IN")}
- Number of due payments: ${filteredPayments.filter((p) => p.paymentStatus !== "FULLY_PAID").length}
- Total completed jobs: ${filteredJobs.filter((j) => j.status === "WORK_COMPLETED" || j.status === "ARCHIVED" || j.status === "COMPLETED").length}
- Top locations by revenue: ${topLocs || "No data yet"}
- Top workers by trees: ${topWorkers || "No data yet"}
- Payment breakdown: Fully Paid ₹${paymentBreakdown.paid}, Partially Paid ₹${paymentBreakdown.partial}, Unpaid ₹${paymentBreakdown.unpaid}
- Monthly revenue trend (last 6 months): ${monthlyData.slice(-6).map((m) => `${m.label}: ₹${m.revenue}`).join(", ")}
- Expense categories: ${[...new Set(filteredExpenses.map((e) => e.type))].join(", ") || "None recorded"}

Respond with ONLY a valid JSON array (no markdown, no code fences). Each element must have:
- "type": one of "trend", "warning", "tip", "forecast"
- "title": short headline (max 8 words)
- "description": detailed insight (1-2 sentences with specific numbers)

Example format: [{"type":"trend","title":"Revenue Growing Steadily","description":"Revenue increased by 23% this month..."}]`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // Try parsing JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AIInsight[];
        setAiInsights(parsed);
      }
    } catch (err) {
      console.error("AI Insights error:", err);
      // Fallback heuristic insights
      const fallback: AIInsight[] = [];
      if (revenueChange > 0) fallback.push({ type: "trend", title: "Revenue is Growing", description: `Revenue increased by ${revenueChange.toFixed(1)}% compared to the previous period. Keep up the momentum.` });
      else if (revenueChange < 0) fallback.push({ type: "warning", title: "Revenue Declined", description: `Revenue dropped by ${Math.abs(revenueChange).toFixed(1)}% versus the previous period. Investigate and take corrective action.` });
      if (totalDue > 0) fallback.push({ type: "warning", title: "Outstanding Dues Alert", description: `₹${totalDue.toLocaleString("en-IN")} remains uncollected across ${filteredPayments.filter((p) => p.paymentStatus !== "FULLY_PAID").length} payments. Prioritize collection.` });
      if (netProfit > 0) fallback.push({ type: "tip", title: "Healthy Profit Margin", description: `Net profit stands at ₹${netProfit.toLocaleString("en-IN")} with a margin of ${totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%.` });
      setAiInsights(fallback);
    } finally {
      setAiLoading(false);
    }
  }, [totalRevenue, prevRevenue, revenueChange, totalExpensesAmt, netProfit, totalDue, filteredPayments, filteredJobs, filteredExpenses, locationStats, workerStats, paymentBreakdown, monthlyData]);

  useEffect(() => {
    if (!loading && allPayments.length > 0) generateAIInsights();
  }, [loading, datePreset]);

  /* ============================== EXPENSE CRUD ============================== */
  const openAddExpense = () => {
    setEditingExpense(null);
    setExpType("Fuel");
    setCustomExpType("");
    setExpDesc("");
    setExpAmount("");
    setExpDate(new Date().toISOString().slice(0, 10));
    setExpenseModalOpen(true);
  };

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    if (EXPENSE_TYPES.includes(exp.type) && exp.type !== "Other") {
      setExpType(exp.type);
      setCustomExpType("");
    } else {
      setExpType("Other");
      setCustomExpType(exp.type);
    }
    setExpDesc(exp.description);
    setExpAmount(String(exp.amount));
    setExpDate(exp.date);
    setExpenseModalOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!expAmount || parseFloat(expAmount) <= 0) { showToast("Enter a valid amount.", "error"); return; }
    if (!expDate) { showToast("Select a date.", "error"); return; }

    let resolvedType = expType;
    if (expType === "Other") {
      if (!customExpType.trim()) {
        showToast("Please enter a custom expense type.", "error");
        return;
      }
      resolvedType = customExpType.trim();
    }

    setExpSubmitting(true);
    try {
      const data = {
        type: resolvedType,
        description: expDesc,
        amount: parseFloat(expAmount),
        date: expDate,
        addedBy: currentUserUid,
        addedByName: currentUserName,
        createdAt: new Date().toISOString(),
      };
      if (editingExpense) {
        await updateDoc(doc(db, "expenses", editingExpense.id), data);
      } else {
        await addDoc(collection(db, "expenses"), data);
      }
      setExpenseModalOpen(false);
      showToast(editingExpense ? "Expense updated successfully." : "Expense added successfully.", "success");
    } catch (err) {
      console.error("Expense save error:", err);
      showToast("Failed to save expense.", "error");
    } finally {
      setExpSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete Expense?",
      message: "Are you sure you want to delete this expense? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });
    if (!confirmed) return;
    try { 
      await deleteDoc(doc(db, "expenses", id)); 
      showToast("Expense deleted successfully.", "success");
    }
    catch (err) { console.error("Delete error:", err); showToast("Failed to delete.", "error"); }
  };

  /* ============================== LEDGER DATA ============================== */
  const ledgerBounds = useMemo(() => {
    if (ledgerPeriodType === "today") {
      const d = new Date(ledgerTodayDate);
      if (isNaN(d.getTime())) {
        const now = new Date();
        return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) };
      }
      const from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      return { from, to };
    } else if (ledgerPeriodType === "month") {
      const parts = ledgerMonth.split("-").map(Number);
      const y = parts[0] || new Date().getFullYear();
      const m = parts[1] || (new Date().getMonth() + 1);
      const from = new Date(y, m - 1, 1, 0, 0, 0);
      const to = new Date(y, m, 0, 23, 59, 59);
      return { from, to };
    } else if (ledgerPeriodType === "year") {
      const y = Number(ledgerYear) || new Date().getFullYear();
      const from = new Date(y, 0, 1, 0, 0, 0);
      const to = new Date(y, 11, 31, 23, 59, 59);
      return { from, to };
    } else {
      const fromD = new Date(ledgerStartDate);
      const toD = new Date(ledgerEndDate);
      const from = isNaN(fromD.getTime()) ? new Date() : new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate(), 0, 0, 0);
      const to = isNaN(toD.getTime()) ? new Date() : new Date(toD.getFullYear(), toD.getMonth(), toD.getDate(), 23, 59, 59);
      return { from, to };
    }
  }, [ledgerPeriodType, ledgerTodayDate, ledgerMonth, ledgerYear, ledgerStartDate, ledgerEndDate]);

  const ledgerExpenses = useMemo(
    () => allExpenses.filter((e) => isInRange(e.date, ledgerBounds.from, ledgerBounds.to)),
    [allExpenses, ledgerBounds]
  );

  const ledgerJobs = useMemo(() => {
    return allJobs
      .filter((j) => isInRange(j.date || j.createdAt, ledgerBounds.from, ledgerBounds.to))
      .map((job) => {
        let totalHarvested = 0;
        let hasHarvestedData = false;
        job.assignedWorkers?.forEach((w) => {
          if (w.status === "accepted" && w.harvestConfirmed) {
            totalHarvested += w.harvestedTrees || 0;
            hasHarvestedData = true;
          }
        });
        const actualTrees = hasHarvestedData ? totalHarvested : (job.trees || 0);
        return {
          ...job,
          trees: actualTrees
        };
      });
  }, [allJobs, ledgerBounds]);

  const ledgerDues = useMemo(
    () => allPayments.filter((p) => (p.paymentStatus === "UNPAID" || p.paymentStatus === "PARTIALLY_PAID") && isInRange(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt, ledgerBounds.from, ledgerBounds.to)),
    [allPayments, ledgerBounds]
  );

  const ledgerRevenue = useMemo(
    () => allPayments.filter((p) => p.paymentStatus === "FULLY_PAID" && isInRange(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt, ledgerBounds.from, ledgerBounds.to)).reduce((s, p) => s + (p.totalAmount || 0), 0),
    [allPayments, ledgerBounds]
  );

  const ledgerTotalExpenses = useMemo(
    () => ledgerExpenses.reduce((s, e) => s + e.amount, 0),
    [ledgerExpenses]
  );

  const ledgerTotalDue = useMemo(
    () => ledgerDues.reduce((s, p) => s + (p.dueAmount || 0), 0),
    [ledgerDues]
  );

  const ledgerTotalTrees = useMemo(
    () => ledgerJobs.reduce((s, j) => s + (j.trees || 0), 0),
    [ledgerJobs]
  );

  /* ============================== CONSOLIDATED LEDGER DATA ============================== */
  const consolidatedLedger = useMemo(() => {
    const list: any[] = [];
    
    // 1. Add payment transactions (credits)
    allPayments.forEach((p) => {
      p.transactions?.forEach((tx) => {
        if (isInRange(tx.date, ledgerBounds.from, ledgerBounds.to)) {
          list.push({
            date: new Date(tx.date),
            type: "CREDIT",
            category: "Job Revenue",
            description: `Payment from ${p.jobDetails?.customerName || "Customer"} (${p.jobDetails?.location || ""})`,
            refId: p.jobId,
            paymentMethod: tx.method,
            debit: 0,
            credit: tx.amount,
          });
        }
      });
    });

    // 2. Add expenses (debits)
    ledgerExpenses.forEach((e) => {
      list.push({
        date: new Date(e.date),
        type: "DEBIT",
        category: e.type,
        description: e.description || `Expense: ${e.type}`,
        refId: e.id,
        paymentMethod: "CASH/BANK",
        debit: e.amount,
        credit: 0,
      });
    });

    // 3. Add outstanding dues (labeled as DUE)
    ledgerDues.forEach((p) => {
      list.push({
        date: new Date(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt),
        type: "DUE",
        category: "Receivable Due",
        description: `Unpaid balance from ${p.jobDetails?.customerName || "Customer"}`,
        refId: p.jobId,
        paymentMethod: "N/A",
        debit: p.dueAmount,
        credit: 0,
      });
    });

    // Sort by date ascending
    list.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance
    let runningBalance = 0;
    const computed = list.map((item) => {
      if (item.type === "CREDIT") {
        runningBalance += item.credit;
      } else if (item.type === "DEBIT") {
        runningBalance -= item.debit;
      }
      return {
        ...item,
        balance: runningBalance,
      };
    });

    return computed;
  }, [allPayments, ledgerExpenses, ledgerDues, ledgerBounds]);

  const periodLabel = useMemo(() => {
    if (ledgerPeriodType === "today") {
      const d = new Date(ledgerTodayDate);
      return isNaN(d.getTime()) ? "Today" : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    } else if (ledgerPeriodType === "month") {
      const parts = ledgerMonth.split("-").map(Number);
      const y = parts[0] || new Date().getFullYear();
      const m = parts[1] || (new Date().getMonth() + 1);
      return `${MONTHS[m - 1]} ${y}`;
    } else if (ledgerPeriodType === "year") {
      return `Year ${ledgerYear}`;
    } else {
      const fromD = new Date(ledgerStartDate);
      const toD = new Date(ledgerEndDate);
      const fromStr = isNaN(fromD.getTime()) ? "" : fromD.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const toStr = isNaN(toD.getTime()) ? "" : toD.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      return `${fromStr} - ${toStr}`;
    }
  }, [ledgerPeriodType, ledgerTodayDate, ledgerMonth, ledgerYear, ledgerStartDate, ledgerEndDate]);

  /* ============================== AVAILABLE METADATA ============================== */
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allJobs.forEach((j) => set.add(getMonthKey(j.date || j.createdAt)));
    allPayments.forEach((p) => set.add(getMonthKey(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt)));
    allExpenses.forEach((e) => set.add(getMonthKey(e.date)));
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    return Array.from(set).sort().reverse();
  }, [allJobs, allPayments, allExpenses]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    allJobs.forEach((j) => {
      const d = new Date(j.date || j.createdAt);
      if (!isNaN(d.getTime())) set.add(String(d.getFullYear()));
    });
    allPayments.forEach((p) => {
      const d = new Date(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt);
      if (!isNaN(d.getTime())) set.add(String(d.getFullYear()));
    });
    allExpenses.forEach((e) => {
      const d = new Date(e.date);
      if (!isNaN(d.getTime())) set.add(String(d.getFullYear()));
    });
    const now = new Date();
    set.add(String(now.getFullYear()));
    return Array.from(set).sort().reverse();
  }, [allJobs, allPayments, allExpenses]);

  /* ============================== CSV DOWNLOAD FUNCTIONS ============================== */
  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatPhoneForCsv = (phone: string | undefined | null) => {
    if (!phone) return '""';
    const cleaned = phone.replace(/[^0-9+]/g, "");
    return `="${cleaned}"`;
  };

  const getLedgerPeriodStr = () => {
    if (ledgerPeriodType === "today") return ledgerTodayDate;
    if (ledgerPeriodType === "month") return ledgerMonth;
    if (ledgerPeriodType === "year") return ledgerYear;
    return `${ledgerStartDate}_to_${ledgerEndDate}`;
  };

  const exportConsolidatedLedgerCSV = () => {
    let csv = "";

    // Table 1: Revenue Table
    csv += "--- REVENUE ---\r\n";
    csv += "Date,Customer Name,Phone,Location,Payment Method,Amount (INR)\r\n";
    const revenueRows: any[] = [];
    allPayments.forEach((p) => {
      p.transactions?.forEach((tx) => {
        if (isInRange(tx.date, ledgerBounds.from, ledgerBounds.to)) {
          revenueRows.push({
            date: new Date(tx.date),
            name: p.jobDetails?.customerName || "Customer",
            phone: p.jobDetails?.phone || "",
            location: p.jobDetails?.location || "",
            method: tx.method || "N/A",
            amount: tx.amount || 0
          });
        }
      });
    });
    revenueRows.sort((a, b) => a.date.getTime() - b.date.getTime());
    revenueRows.forEach((row) => {
      const dateStr = row.date.toLocaleDateString("en-IN");
      const nameEscaped = `"${row.name.replace(/"/g, '""')}"`;
      const phoneVal = formatPhoneForCsv(row.phone);
      const locEscaped = `"${row.location.replace(/"/g, '""')}"`;
      const methodEscaped = `"${row.method.replace(/"/g, '""')}"`;
      csv += `${dateStr},${nameEscaped},${phoneVal},${locEscaped},${methodEscaped},${row.amount}\r\n`;
    });

    csv += "\r\n";

    // Table 2: Profit & Loss Table
    csv += "--- PROFIT & LOSS ---\r\n";
    csv += "Metric,Amount (INR)\r\n";
    const totalRev = revenueRows.reduce((sum, r) => sum + r.amount, 0);
    const totalExp = ledgerExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProf = totalRev - totalExp;

    csv += `Total Revenue,${totalRev}\r\n`;
    csv += `Total Expenses,${totalExp}\r\n`;
    csv += `Net Profit,${netProf}\r\n`;
    
    csv += "\r\n";

    // Table 3: Due Amount Table
    csv += "--- OUTSTANDING DUES ---\r\n";
    csv += "Customer Name,Phone,Location,Total Amount (INR),Paid Amount (INR),Due Amount (INR),Last Updated\r\n";
    ledgerDues.forEach((p) => {
      const dateStr = new Date(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt).toLocaleDateString("en-IN");
      const nameEscaped = `"${(p.jobDetails?.customerName || "").replace(/"/g, '""')}"`;
      const phoneVal = formatPhoneForCsv(p.jobDetails?.phone);
      const locEscaped = `"${(p.jobDetails?.location || "").replace(/"/g, '""')}"`;
      csv += `${nameEscaped},${phoneVal},${locEscaped},${p.totalAmount || 0},${p.paidAmount || 0},${p.dueAmount || 0},${dateStr}\r\n`;
    });

    const periodStr = getLedgerPeriodStr();
    downloadCSV(`Cocofy_Consolidated_Ledger_${periodStr}.csv`, csv);
  };

  const exportJobsCSV = () => {
    let csv = "Date,Customer Name,Phone,Location,Trees Harvested,Price Per Tree,Workers Required,Total Cost (INR),Status\r\n";
    ledgerJobs.forEach((job) => {
      const dateStr = new Date(job.date || job.createdAt).toLocaleDateString("en-IN");
      const nameEscaped = `"${job.customerName.replace(/"/g, '""')}"`;
      const phoneVal = formatPhoneForCsv(job.phone);
      const locEscaped = `"${job.location.replace(/"/g, '""')}"`;
      const ppt = parsePrice(job.pricePerTree);
      const total = job.trees * ppt;
      csv += `${dateStr},${nameEscaped},${phoneVal},${locEscaped},${job.trees},${ppt},${job.workersRequired},${total},${job.status}\r\n`;
    });
    const periodStr = getLedgerPeriodStr();
    downloadCSV(`Cocofy_Jobs_${periodStr}.csv`, csv);
  };

  const exportExpensesCSV = () => {
    let csv = "Date,Expense Type,Description,Amount (INR),Added By Name\r\n";
    ledgerExpenses.forEach((exp) => {
      const dateStr = new Date(exp.date).toLocaleDateString("en-IN");
      const descEscaped = `"${(exp.description || "").replace(/"/g, '""')}"`;
      const nameEscaped = `"${(exp.addedByName || "").replace(/"/g, '""')}"`;
      csv += `${dateStr},${exp.type},${descEscaped},${exp.amount},${nameEscaped}\r\n`;
    });
    const periodStr = getLedgerPeriodStr();
    downloadCSV(`Cocofy_Expenses_${periodStr}.csv`, csv);
  };

  const exportDuesCSV = () => {
    let csv = "Customer Name,Phone,Location,Total Amount (INR),Paid Amount (INR),Due Amount (INR),Payment Status,Last Updated\r\n";
    ledgerDues.forEach((p) => {
      const dateStr = new Date(p.lastUpdatedAt || p.jobDetails?.date || p.jobDetails?.createdAt).toLocaleDateString("en-IN");
      const nameEscaped = `"${(p.jobDetails?.customerName || "").replace(/"/g, '""')}"`;
      const phoneVal = formatPhoneForCsv(p.jobDetails?.phone);
      const locEscaped = `"${(p.jobDetails?.location || "").replace(/"/g, '""')}"`;
      csv += `${nameEscaped},${phoneVal},${locEscaped},${p.totalAmount},${p.paidAmount},${p.dueAmount},${p.paymentStatus},${dateStr}\r\n`;
    });
    const periodStr = getLedgerPeriodStr();
    downloadCSV(`Cocofy_Dues_${periodStr}.csv`, csv);
  };

  /* ============================== PDF GENERATION ============================== */
  const handleDownloadPdf = async () => {
    const el = ledgerPdfRef.current;
    if (!el) return;
    setGeneratingPdf(true);
    try {
      el.style.display = "block";
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      el.style.display = "none";
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      
      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfH;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfW, pdfH);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfW, pdfH);
        heightLeft -= pageHeight;
      }

      let pdfFileName = `Cocofy_Ledger_`;
      if (ledgerPeriodType === "today") {
        pdfFileName += `Daily_${ledgerTodayDate}`;
      } else if (ledgerPeriodType === "month") {
        const [y, m] = ledgerMonth.split("-");
        pdfFileName += `${MONTHS[parseInt(m) - 1]}_${y}`;
      } else if (ledgerPeriodType === "year") {
        pdfFileName += `Annual_${ledgerYear}`;
      } else {
        pdfFileName += `Custom_${ledgerStartDate}_to_${ledgerEndDate}`;
      }
      pdf.save(`${pdfFileName}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      showToast("Failed to generate PDF.", "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  /* ============================== CHART: AREA ============================== */
  const AreaChart = useMemo(() => {
    const W = 700, H = 280, PL = 60, PR = 20, PT = 20, PB = 40;
    const cw = W - PL - PR, ch = H - PT - PB;
    const data = monthlyData;
    if (data.length === 0) return null;

    const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.expenses]), 1);
    const yStep = Math.ceil(maxVal / 5);
    const yMax = yStep * 5;

    const toX = (i: number) => PL + (i / (data.length - 1)) * cw;
    const toY = (v: number) => PT + ch - (v / yMax) * ch;

    const revPoints = data.map((d, i) => ({ x: toX(i), y: toY(d.revenue) }));
    const expPoints = data.map((d, i) => ({ x: toX(i), y: toY(d.expenses) }));

    const revLine = createSmoothPath(revPoints);
    const expLine = createSmoothPath(expPoints);
    const revArea = revLine + ` L ${toX(data.length - 1)} ${PT + ch} L ${PL} ${PT + ch} Z`;
    const expArea = expLine + ` L ${toX(data.length - 1)} ${PT + ch} L ${PL} ${PT + ch} Z`;

    const gridLines = Array.from({ length: 6 }, (_, i) => i * yStep);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef233c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef233c" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {gridLines.map((v, i) => (
          <g key={i}>
            <line x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            <text x={PL - 8} y={toY(v) + 4} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {/* X Labels */}
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={H - 8} fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">{d.label}</text>
        ))}
        {/* Areas */}
        <path d={revArea} fill="url(#revGrad)" />
        <path d={expArea} fill="url(#expGrad)" />
        {/* Lines */}
        <path d={revLine} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px var(--accent-glow))" }} />
        <path d={expLine} fill="none" stroke="#ef233c" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 3" />
        {/* Dots */}
        {revPoints.map((p, i) => (
          <circle key={`r${i}`} cx={p.x} cy={p.y} r="4" fill="var(--accent)" stroke="var(--background)" strokeWidth="2" style={{ filter: "drop-shadow(0 0 4px var(--accent-glow-border))" }}>
            <title>{data[i].label}: {fmtFull(data[i].revenue)}</title>
          </circle>
        ))}
        {expPoints.map((p, i) => (
          <circle key={`e${i}`} cx={p.x} cy={p.y} r="3" fill="#ef233c" stroke="#0d0628" strokeWidth="2">
            <title>{data[i].label}: {fmtFull(data[i].expenses)}</title>
          </circle>
        ))}
      </svg>
    );
  }, [monthlyData]);

  /* ============================== CHART: DONUT ============================== */
  const DonutChart = useMemo(() => {
    const { paid, partial, unpaid, total } = paymentBreakdown;
    if (total === 0) return null;
    const R = 60, cx = 80, cy = 80, sw = 18;
    const C = 2 * Math.PI * R;
    const segments = [
      { value: paid, color: "#10b981", label: "Paid" },
      { value: partial, color: "#f59e0b", label: "Partial" },
      { value: unpaid, color: "#ef233c", label: "Unpaid" },
    ].filter((s) => s.value > 0);

    let offset = 0;
    return (
      <svg viewBox="0 0 160 160" style={{ width: "160px", height: "160px" }}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * C;
          const gap = C - dash;
          const rot = (offset / total) * 360 - 90;
          offset += seg.value;
          return (
            <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={seg.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${gap}`} transform={`rotate(${rot} ${cx} ${cy})`}
              style={{ filter: `drop-shadow(0 0 4px ${seg.color}55)`, transition: "stroke-dasharray 0.6s ease" }}>
              <title>{seg.label}: {fmtFull(seg.value)}</title>
            </circle>
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="14" fontWeight="700">{fmt(total)}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">Total</text>
      </svg>
    );
  }, [paymentBreakdown]);

  /* ============================== INSIGHT ICON ============================== */
  const insightIcon = (type: string) => {
    switch (type) {
      case "trend": return <TrendingUp size={18} color="var(--accent)" />;
      case "warning": return <ShieldAlert size={18} color="#f59e0b" />;
      case "tip": return <Lightbulb size={18} color="#10b981" />;
      case "forecast": return <Zap size={18} color="var(--primary)" />;
      default: return <Sparkles size={18} color="var(--accent)" />;
    }
  };

  const insightColor = (type: string) => {
    switch (type) {
      case "trend": return "var(--accent-glow)";
      case "warning": return "rgba(245,158,11,0.12)";
      case "tip": return "rgba(16,185,129,0.12)";
      case "forecast": return "var(--primary-glow)";
      default: return "var(--accent-glow)";
    }
  };

  const insightBorder = (type: string) => {
    switch (type) {
      case "trend": return "var(--accent-glow-border)";
      case "warning": return "rgba(245,158,11,0.3)";
      case "tip": return "rgba(16,185,129,0.3)";
      case "forecast": return "var(--primary-glow-border)";
      default: return "var(--accent-glow-border)";
    }
  };

  /* ============================== RENDER ============================== */
  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
        <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Analytics & Ledger" />

        <div className="analytics-content-wrapper" style={{ padding: "2rem 2.5rem", flex: 1, maxWidth: "1500px", margin: "0 auto", width: "100%" }}>

          {/* ===== TAB SWITCHER ===== */}
          <div className="tab-switcher" style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
            {(["analytics", "ledger"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "0.75rem 2rem", borderRadius: "12px", border: "1px solid",
                borderColor: activeTab === tab ? "var(--primary)" : "var(--surface-border)",
                background: activeTab === tab ? "rgba(123,44,191,0.15)" : "rgba(255,255,255,0.03)",
                color: activeTab === tab ? "white" : "rgba(255,255,255,0.6)",
                fontWeight: 600, fontSize: "0.95rem", cursor: "pointer",
                transition: "all 0.3s ease", display: "flex", alignItems: "center", gap: "0.5rem",
                textTransform: "capitalize"
              }}>
                {tab === "analytics" ? <BarChart3 size={18} /> : <BookOpen size={18} />}
                {tab}
              </button>
            ))}
          </div>

          {/* ===================================================================
              ANALYTICS TAB
              =================================================================== */}
          {activeTab === "analytics" && (
            <>
              {/* ----- DATE RANGE FILTER ----- */}
              <div className="analytics-filter-row" style={{
                display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2rem",
                padding: "1rem 1.25rem", borderRadius: "14px",
                background: "rgba(255,255,255,0.02)", border: "1px solid var(--surface-border)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "0.5rem" }}>
                  <Calendar size={16} color="var(--accent)" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>Period:</span>
                </div>
                {DATE_PRESETS.map((p) => (
                  <button key={p.id} onClick={() => setDatePreset(p.id)} style={{
                    padding: "0.4rem 0.85rem", borderRadius: "8px", fontSize: "0.8rem",
                    background: datePreset === p.id ? "var(--surface-2)" : "transparent",
                    border: `1px solid ${datePreset === p.id ? "var(--primary)" : "transparent"}`,
                    color: datePreset === p.id ? "var(--foreground)" : "var(--text-light)",
                    cursor: "pointer", fontWeight: 500, transition: "all 0.2s"
                  }}>{p.label}</button>
                ))}
                <button onClick={() => setDatePreset("custom")} style={{
                  padding: "0.4rem 0.85rem", borderRadius: "8px", fontSize: "0.8rem",
                  background: datePreset === "custom" ? "var(--surface-2)" : "transparent",
                  border: `1px solid ${datePreset === "custom" ? "var(--primary)" : "transparent"}`,
                  color: datePreset === "custom" ? "var(--foreground)" : "var(--text-light)",
                  cursor: "pointer", fontWeight: 500, transition: "all 0.2s"
                }}>Custom</button>
                {datePreset === "custom" && (
                  <div className="custom-date-picker-wrapper" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <div className="custom-date-input" style={{ width: "160px" }}>
                      <DatePicker value={customFrom} onChange={setCustomFrom} />
                    </div>
                    <span className="custom-date-sep" style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>to</span>
                    <div className="custom-date-input" style={{ width: "160px" }}>
                      <DatePicker value={customTo} onChange={setCustomTo} />
                    </div>
                  </div>
                )}
              </div>

              {/* ----- KPI CARDS ----- */}
              <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
                <KPICard label="Total Revenue" value={animatedRevenue} icon={<IndianRupee size={22} />} color="#10b981" change={revenueChange} />
                <KPICard label="Total Expenses" value={animatedExpenses} icon={<Receipt size={22} />} color="#ef233c" />
                <KPICard label="Net Profit" value={animatedProfit} icon={<TrendingUp size={22} />} color={netProfit >= 0 ? "var(--accent)" : "var(--error)"} />
                <KPICard label="Outstanding Dues" value={animatedDue} icon={<AlertTriangle size={22} />} color="#f59e0b" />
              </div>

              {/* ----- CHARTS ROW ----- */}
              <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: "1.25rem", marginBottom: "2rem" }}>
                {/* Area Chart */}
                <div style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Revenue vs Expenses</h3>
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ width: 10, height: 3, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} /> Revenue
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ width: 10, height: 3, borderRadius: 2, background: "#ef233c", display: "inline-block", borderTop: "1px dashed #ef233c" }} /> Expenses
                      </span>
                    </div>
                  </div>
                  {AreaChart || <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "3rem 0" }}>No data to display</p>}
                </div>

                {/* Donut + Payment Breakdown */}
                <div style={cardStyle}>
                  <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 700 }}>Payment Status</h3>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                    {DonutChart || <p style={{ color: "rgba(255,255,255,0.4)", padding: "2rem 0" }}>No payments</p>}
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {[
                        { label: "Fully Paid", value: paymentBreakdown.paid, color: "#10b981" },
                        { label: "Partially Paid", value: paymentBreakdown.partial, color: "#f59e0b" },
                        { label: "Unpaid", value: paymentBreakdown.unpaid, color: "#ef233c" },
                      ].map((item) => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                            <span style={{ color: "rgba(255,255,255,0.7)" }}>{item.label}</span>
                          </span>
                          <span style={{ fontWeight: 600 }}>{fmtFull(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ----- LOCATION BAR CHART ----- */}
              <div style={{ ...cardStyle, marginBottom: "2rem" }}>
                <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <MapPin size={18} color="var(--accent)" /> Revenue by Location
                </h3>
                {locationStats.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {locationStats.map((loc, i) => {
                      const maxRev = locationStats[0]?.revenue || 1;
                      const pct = (loc.revenue / maxRev) * 100;
                      return (
                        <div key={loc.location} className="location-stat-row" style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: 550 }}>
                            <span style={{ color: "var(--foreground)" }}>{loc.location}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                              {fmtFull(loc.revenue)} · {loc.jobs} {loc.jobs === 1 ? 'job' : 'jobs'} · {loc.trees} {loc.trees === 1 ? 'tree' : 'trees'}
                            </span>
                          </div>
                          <div style={{ height: "10px", background: "rgba(255,255,255,0.04)", borderRadius: "6px", overflow: "hidden", position: "relative" }}>
                            <div style={{
                              width: `${pct}%`, height: "100%", borderRadius: "6px",
                              background: `linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)`,
                              transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)"
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "2rem 0" }}>No location data yet</p>}
              </div>

              {/* ----- BEST WORKER & BEST LOCATION ROW ----- */}
              <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "2rem" }}>
                {/* Best Workers */}
                <div style={cardStyle}>
                  <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Award size={18} color="#f59e0b" /> Top Performers
                  </h3>
                  {workerStats.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {workerStats.map((w, i) => (
                        <div key={w.uid} style={{
                          display: "flex", alignItems: "center", gap: "0.75rem",
                          padding: "0.75rem 1rem", borderRadius: "10px",
                          background: i === 0 ? "rgba(245,158,11,0.08)" : i === 1 ? "rgba(192,192,192,0.06)" : i === 2 ? "rgba(205,127,50,0.06)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${i === 0 ? "rgba(245,158,11,0.25)" : i === 1 ? "rgba(192,192,192,0.2)" : i === 2 ? "rgba(205,127,50,0.2)" : "rgba(255,255,255,0.06)"}`,
                          transition: "all 0.3s ease"
                        }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            background: i === 0 ? "linear-gradient(135deg, #f59e0b, #eab308)" : i === 1 ? "linear-gradient(135deg, #9ca3af, #d1d5db)" : i === 2 ? "linear-gradient(135deg, #cd7f32, #b8860b)" : "var(--surface-2)",
                            fontSize: "0.8rem", fontWeight: 700, color: i < 3 ? "#000" : "var(--foreground)"
                          }}>
                            {i < 3 ? <Crown size={16} /> : i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{w.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{w.totalJobs} jobs · {fmtFull(w.revenue)} earned</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--accent)" }}>{w.totalTrees}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>trees</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ color: "var(--text-dim)", textAlign: "center", padding: "2rem 0" }}>No worker data yet</p>}
                </div>

                {/* Best Locations */}
                <div style={cardStyle}>
                  <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Target size={18} color="#10b981" /> Most Profitable Locations
                  </h3>
                  {locationStats.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {locationStats.slice(0, 5).map((loc, i) => (
                        <div key={loc.location} style={{
                          display: "flex", alignItems: "center", gap: "0.75rem",
                          padding: "0.75rem 1rem", borderRadius: "10px",
                          background: "var(--surface-1)", border: "1px solid var(--surface-border)",
                          transition: "all 0.3s ease"
                        }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
                            background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)"
                          }}>
                            <MapPin size={16} color="#10b981" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{loc.location}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{loc.jobs} jobs · {loc.trees} trees</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "#10b981", fontSize: "1rem" }}>{fmtFull(loc.revenue)}</div>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ color: "var(--text-dim)", textAlign: "center", padding: "2rem 0" }}>No location data yet</p>}
                </div>
              </div>



              <div className="finance-tools-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
                {/* 3. Budget vs Actual Planner */}
                <div className="budget-planner-card span-2-card" style={{ ...cardStyle }}>
                  <div className="card-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <DollarSign size={18} color="#ef233c" /> Budget vs Actual Expense Planner
                    </h3>
                    <button 
                      onClick={() => setEditingBudgets(!editingBudgets)}
                      style={{
                        padding: "0.4rem 0.85rem", borderRadius: "8px", fontSize: "0.75rem",
                        background: editingBudgets ? "rgba(16,185,129,0.15)" : "var(--surface-2)",
                        border: `1px solid ${editingBudgets ? "#10b981" : "var(--surface-border)"}`,
                        color: editingBudgets ? "#10b981" : "var(--foreground)", cursor: "pointer", fontWeight: 600, transition: "all 0.2s"
                      }}
                    >
                      {editingBudgets ? "Save Budgets" : "Edit Limits"}
                    </button>
                  </div>
                  <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Monitor spending limits across categories. Spend limits are color-coded: Green (≤70%), Orange (71-100%), Red (&gt;100% Alert).
                  </p>

                  <div className="budget-planner-categories" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                    {EXPENSE_TYPES.slice(0, 10).map((cat) => {
                      const budget = categoryBudgets[cat] || 0;
                      const actual = categoryExpenses[cat] || 0;
                      const utilPct = budget > 0 ? Math.min(150, Math.round((actual / budget) * 100)) : 0;
                      
                      let barColor = "#10b981"; // green
                      if (utilPct > 100) barColor = "#ef233c"; // red
                      else if (utilPct > 70) barColor = "#f59e0b"; // orange

                      return (
                        <div key={cat} style={{
                          padding: "0.75rem 1rem", borderRadius: "10px",
                          background: "var(--surface-overlay)", border: "1px solid var(--surface-border)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{cat}</span>
                            {utilPct > 100 && <AlertTriangle size={14} color="#ef233c" style={{ filter: "drop-shadow(0 0 4px rgba(239,35,60,0.5))" }} />}
                          </div>
                          
                          <div className="budget-status-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-light)", marginBottom: "0.4rem" }}>
                            <span>Actual: <span style={{ color: actual > 0 ? "var(--foreground)" : "var(--text-dim)" }}>₹{actual.toLocaleString()}</span></span>
                            {editingBudgets ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <span>Limit: ₹</span>
                                <input 
                                  type="number"
                                  value={budget}
                                  onChange={(e) => setCategoryBudgets({ ...categoryBudgets, [cat]: Math.max(0, Number(e.target.value)) })}
                                  style={{
                                    width: "70px", background: "var(--background)", border: "1px solid var(--surface-border)",
                                    borderRadius: "4px", color: "var(--foreground)", padding: "0.1rem 0.3rem", fontSize: "0.75rem", textAlign: "right"
                                  }}
                                />
                              </div>
                            ) : (
                              <span>Limit: <span style={{ color: "var(--foreground)" }}>₹{budget.toLocaleString()}</span></span>
                            )}
                          </div>

                          <div style={{ height: "6px", background: "var(--surface-2)", borderRadius: "3px", overflow: "hidden", position: "relative" }}>
                            <div style={{
                              width: `${Math.min(100, utilPct)}%`, height: "100%", background: barColor,
                              borderRadius: "3px", transition: "width 0.3s ease"
                            }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginTop: "0.2rem", color: "var(--text-dim)" }}>
                            <span>Usage</span>
                            <span style={{ color: barColor, fontWeight: 600 }}>{utilPct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Dues Aging & Reminder Generator */}
                <div className="dues-aging-card" style={cardStyle}>
                  <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <AlertTriangle size={18} color="#f59e0b" /> Dues Aging & Collection Assistant
                  </h3>
                  <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
                    Monitor how long invoices have been unpaid and draft recovery messages for clients.
                  </p>

                  <div className="dues-buckets-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "1.25rem", textAlign: "center" }}>
                    <div style={{ padding: "0.5rem", borderRadius: "8px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
                      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>0-7 Days</div>
                      <div style={{ fontWeight: 700, color: "#10b981", fontSize: "0.95rem" }}>{fmtFull(agingDuesData.bucket1Amt)}</div>
                      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>{agingDuesData.bucket1} accounts</div>
                    </div>
                    <div style={{ padding: "0.5rem", borderRadius: "8px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
                      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>8-30 Days</div>
                      <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: "0.95rem" }}>{fmtFull(agingDuesData.bucket2Amt)}</div>
                      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>{agingDuesData.bucket2} accounts</div>
                    </div>
                    <div style={{ padding: "0.5rem", borderRadius: "8px", background: "rgba(239,35,60,0.05)", border: "1px solid rgba(239,35,60,0.15)" }}>
                      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>31+ Days</div>
                      <div style={{ fontWeight: 700, color: "#ef233c", fontSize: "0.95rem" }}>{fmtFull(agingDuesData.bucket3Amt)}</div>
                      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>{agingDuesData.bucket3} accounts</div>
                    </div>
                  </div>

                  <div style={{
                    padding: "0.5rem 0.75rem", borderRadius: "8px", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem"
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Average Settlement Speed</span>
                    <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.85rem" }}>{agingDuesData.avgVelocity} Days</span>
                  </div>

                  <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", fontWeight: 600 }}>Draft Reminder Generator</h4>
                    {agingDuesData.dueList.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <select 
                          value={selectedDueClient} 
                          onChange={(e) => setSelectedDueClient(e.target.value)}
                          style={{ ...inputStyle, width: "100%", fontSize: "0.8rem", padding: "0.5rem" }}
                        >
                          <option value="">-- Choose Client with Due Balance --</option>
                          {agingDuesData.dueList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.jobDetails?.customerName} (Due: ₹{(p.dueAmount || 0).toLocaleString()})
                            </option>
                          ))}
                        </select>

                        {selectedDueClient && (
                          <>
                            <div className="reminder-template-btns" style={{ display: "flex", gap: "0.25rem" }}>
                              {(["friendly", "formal", "urgent"] as const).map((t) => (
                                <button
                                  key={t}
                                  onClick={() => setReminderTemplate(t)}
                                  style={{
                                    flex: 1, padding: "0.3rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem",
                                    background: reminderTemplate === t ? "rgba(123,44,191,0.2)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${reminderTemplate === t ? "var(--primary)" : "rgba(255,255,255,0.1)"}`,
                                    color: reminderTemplate === t ? "white" : "rgba(255,255,255,0.6)",
                                    cursor: "pointer", fontWeight: 600, textTransform: "capitalize", transition: "all 0.2s"
                                  }}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>

                            {(() => {
                              const p = agingDuesData.dueList.find((x) => x.id === selectedDueClient);
                              if (!p) return null;
                              const clientName = p.jobDetails?.customerName || "Client";
                              const amount = (p.dueAmount || 0).toLocaleString();
                              const location = p.jobDetails?.location || "your estate";
                              
                              let message = "";
                              if (reminderTemplate === "friendly") {
                                message = `Hi ${clientName}, just a friendly note from Cocofy. There is a pending balance of ₹${amount} for the coconut tree harvesting completed at ${location}. Please settle at your convenience. Thank you!`;
                              } else if (reminderTemplate === "formal") {
                                message = `Dear ${clientName}, this is a payment request from Cocofy. Our records show an outstanding balance of ₹${amount} for our harvesting work at ${location} (Job Ref: ${p.jobId?.substring(0, 8)}). Please arrange a bank transfer or UPI transfer. Best regards, accounts team.`;
                              } else {
                                message = `URGENT: Dear ${clientName}, payment of ₹${amount} for Cocofy harvesting services at ${location} is now critically overdue. Kindly process this settlement immediately to avoid service restrictions. Thank you.`;
                              }

                              const handleCopy = () => {
                                navigator.clipboard.writeText(message);
                                setCopiedNotification(true);
                                setTimeout(() => setCopiedNotification(false), 2000);
                              };

                              return (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                  <textarea
                                    readOnly
                                    value={message}
                                    style={{
                                      width: "100%", height: "70px", background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                                      borderRadius: "8px", color: "var(--foreground)", padding: "0.5rem", fontSize: "0.75rem",
                                      fontFamily: "inherit", resize: "none"
                                    }}
                                  />
                                  <button
                                    onClick={handleCopy}
                                    style={{
                                      alignSelf: "flex-end", padding: "0.4rem 1rem", borderRadius: "6px", fontSize: "0.75rem",
                                      background: "linear-gradient(135deg, var(--primary), var(--accent))", border: "none",
                                      color: "white", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem"
                                    }}
                                  >
                                    {copiedNotification ? "Copied!" : "Copy Message"}
                                  </button>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-dim)" }}>No outstanding accounts to draft reminders.</p>
                    )}
                  </div>
                </div>

                {/* 5. Location Profitability Analysis */}
                <div className="margin-ranker-card" style={cardStyle}>
                  <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <MapPin size={18} color="var(--accent)" /> Location Margin Ranker
                  </h3>
                  <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
                    Rank sectors by net profit margin after variable harvesting labor
                  </p>
                  <div style={{ maxHeight: "250px", overflowY: "auto", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {locationProfitability.length > 0 ? (
                      <div className="ranker-table-container">
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                          <thead>
                            <tr style={{ background: "var(--accent-glow)" }}>
                              <th style={{ padding: "0.5rem", textAlign: "left", color: "rgba(255,255,255,0.5)" }}>Location</th>
                              <th style={{ padding: "0.5rem", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>Revenue</th>
                              <th style={{ padding: "0.5rem", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>Net Profit</th>
                              <th style={{ padding: "0.5rem", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>Margin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {locationProfitability.map((loc, idx) => (
                              <tr key={loc.location} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "0.5rem", fontWeight: 600 }}>{loc.location}</td>
                                <td style={{ padding: "0.5rem", textAlign: "right" }}>₹{loc.revenue.toLocaleString()}</td>
                                <td style={{ padding: "0.5rem", textAlign: "right", color: loc.profit >= 0 ? "#10b981" : "#ef233c" }}>
                                  ₹{loc.profit.toLocaleString()}
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 700, color: loc.margin >= 50 ? "#10b981" : loc.margin >= 20 ? "#f59e0b" : "#ef233c" }}>
                                  {loc.margin}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>No location jobs tracked.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ----- CUSTOM EXPENSES ----- */}
              <div style={{ ...cardStyle, marginBottom: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Receipt size={18} color="var(--accent)" /> Custom Expenses
                  </h3>
                  <button onClick={openAddExpense} style={{
                    display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem",
                    borderRadius: "8px", background: "linear-gradient(135deg, var(--primary), var(--accent))",
                    border: "none", color: "white", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                    transition: "all 0.2s"
                  }}>
                    <Plus size={16} /> Add Expense
                  </button>
                </div>

                {filteredExpenses.length > 0 ? (
                  <div className="scroll-table-container" style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "rgba(123,44,191,0.1)" }}>
                          {["#", "Date", "Type", "Description", "Amount", "Actions"].map((h) => (
                            <th key={h} style={{
                              padding: "0.75rem 1rem", textAlign: h === "Amount" ? "right" : "left",
                              fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.6)",
                              textTransform: "uppercase", letterSpacing: "0.05em",
                              borderBottom: "1px solid rgba(255,255,255,0.08)"
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpenses.map((exp, i) => (
                          <tr key={exp.id} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "0.7rem 1rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>{i + 1}</td>
                            <td style={{ padding: "0.7rem 1rem", fontSize: "0.85rem" }}>{new Date(exp.date).toLocaleDateString("en-IN")}</td>
                            <td style={{ padding: "0.7rem 1rem" }}>
                              <span style={{
                                padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600,
                                background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent-glow-border)"
                              }}>{exp.type}</span>
                            </td>
                            <td style={{ padding: "0.7rem 1rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{exp.description || "—"}</td>
                            <td style={{ padding: "0.7rem 1rem", fontSize: "0.9rem", fontWeight: 600, textAlign: "right", color: "#ef233c" }}>₹{exp.amount.toLocaleString("en-IN")}</td>
                            <td style={{ padding: "0.7rem 1rem" }}>
                              <div style={{ display: "flex", gap: "0.4rem" }}>
                                <button onClick={() => openEditExpense(exp)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: "0.3rem" }}>
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,35,60,0.7)", padding: "0.3rem" }}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                          <td colSpan={4} style={{ padding: "0.75rem 1rem", fontWeight: 700, fontSize: "0.9rem", textAlign: "right" }}>Total Expenses:</td>
                          <td style={{ padding: "0.75rem 1rem", fontWeight: 700, fontSize: "1rem", textAlign: "right", color: "#ef233c" }}>₹{totalExpensesAmt.toLocaleString("en-IN")}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem",
                    background: "rgba(13,6,40,0.3)", borderRadius: "12px", border: "1px dashed var(--surface-border)"
                  }}>
                    <p style={{ color: "rgba(255,255,255,0.4)", margin: 0 }}>No expenses recorded for this period. Click "Add Expense" to start tracking.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===================================================================
              LEDGER TAB
              =================================================================== */}
          {activeTab === "ledger" && (
            <>
              {/* Redesigned Ledger Controls */}
              <div style={{
                display: "flex", flexDirection: "column", gap: "1.25rem",
                marginBottom: "2rem", padding: "1.5rem", borderRadius: "16px",
                background: "rgba(255,255,255,0.02)", border: "1px solid var(--surface-border)"
              }}>
                {/* Row 1: Period Type & Date Picker */}
                <div className="ledger-period-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Calendar size={18} color="var(--accent)" />
                    <span style={{ fontWeight: 600, fontSize: "0.95rem", marginRight: "0.5rem" }}>Statement Period:</span>
                    
                    {/* Period Switcher buttons */}
                    <div style={{ display: "flex", background: "var(--surface-2)", padding: "0.2rem", borderRadius: "10px", border: "1px solid var(--surface-border)" }}>
                      {(["today", "month", "year", "custom"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setLedgerPeriodType(type)}
                          style={{
                            padding: "0.4rem 1rem", borderRadius: "8px", fontSize: "0.8rem",
                            background: ledgerPeriodType === type ? "var(--primary)" : "transparent",
                            border: "none", color: ledgerPeriodType === type ? "white" : "var(--text-light)",
                            cursor: "pointer", fontWeight: 600, textTransform: "capitalize", transition: "all 0.2s"
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contextual Date Picker */}
                  <div className="ledger-date-row" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {ledgerPeriodType === "today" && (
                      <div style={{ width: "160px" }}>
                        <DatePicker 
                          value={ledgerTodayDate} 
                          onChange={setLedgerTodayDate} 
                        />
                      </div>
                    )}
                    {ledgerPeriodType === "month" && (
                      <select 
                        value={ledgerMonth} 
                        onChange={(e) => setLedgerMonth(e.target.value)} 
                        style={{ ...inputStyle, minWidth: "150px", width: "100%" }}
                      >
                        {availableMonths.map((m) => {
                          const [y, mo] = m.split("-");
                          return <option key={m} value={m}>{MONTHS[parseInt(mo) - 1]} {y}</option>;
                        })}
                      </select>
                    )}
                    {ledgerPeriodType === "year" && (
                      <select 
                        value={ledgerYear} 
                        onChange={(e) => setLedgerYear(e.target.value)} 
                        style={{ ...inputStyle, minWidth: "120px", width: "100%" }}
                      >
                        {availableYears.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    )}
                    {ledgerPeriodType === "custom" && (
                      <div className="custom-date-picker-wrapper" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-light)", whiteSpace: "nowrap" }}>From:</span>
                        <div className="custom-date-input" style={{ width: "160px" }}>
                          <DatePicker 
                            value={ledgerStartDate} 
                            onChange={setLedgerStartDate} 
                          />
                        </div>
                        <span className="custom-date-sep" style={{ fontSize: "0.8rem", color: "var(--text-light)", whiteSpace: "nowrap" }}>To:</span>
                        <div className="custom-date-input" style={{ width: "160px" }}>
                          <DatePicker 
                            value={ledgerEndDate} 
                            onChange={setLedgerEndDate} 
                          />
                        </div>
                      </div>
                    )}
                    
                    <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600, background: "rgba(123,44,191,0.1)", padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(123,44,191,0.2)", whiteSpace: "nowrap" }}>
                      Active: {periodLabel}
                    </span>
                  </div>
                </div>

                {/* Row 2: Format Switcher & Export buttons */}
                <div className="ledger-export-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", borderTop: "1px dashed var(--surface-border)", paddingTop: "1rem" }}>
                  {/* Format switcher */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 550 }}>Layout View:</span>
                    <div style={{ display: "flex", background: "var(--surface-2)", padding: "0.2rem", borderRadius: "10px", border: "1px solid var(--surface-border)" }}>
                      <button
                        onClick={() => setLedgerViewMode("tables")}
                        style={{
                          padding: "0.4rem 0.85rem", borderRadius: "8px", fontSize: "0.8rem",
                          background: ledgerViewMode === "tables" ? "var(--primary)" : "transparent",
                          border: "none", color: ledgerViewMode === "tables" ? "white" : "var(--text-light)",
                          cursor: "pointer", fontWeight: 600, transition: "all 0.2s"
                        }}
                      >
                        Categorized Tables
                      </button>
                      <button
                        onClick={() => setLedgerViewMode("consolidated")}
                        style={{
                          padding: "0.4rem 0.85rem", borderRadius: "8px", fontSize: "0.8rem",
                          background: ledgerViewMode === "consolidated" ? "var(--primary)" : "transparent",
                          border: "none", color: ledgerViewMode === "consolidated" ? "white" : "var(--text-light)",
                          cursor: "pointer", fontWeight: 600, transition: "all 0.2s"
                        }}
                      >
                        Consolidated Statement
                      </button>
                    </div>
                  </div>

                  {/* CSV Export & PDF controls */}
                  <div className="ledger-action-btns" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {/* CSV Exports */}
                    <div className="ledger-csv-group" style={{ display: "flex", gap: "0.25rem", background: "var(--surface-2)", padding: "0.2rem", borderRadius: "10px", border: "1px solid var(--surface-border)" }}>
                      <button onClick={exportConsolidatedLedgerCSV} title="Download consolidated CSV" style={csvBtnStyle}>
                        <Download size={14} /> Consolidated CSV
                      </button>
                      <button onClick={exportJobsCSV} title="Download jobs CSV" style={csvBtnStyle}>
                        Jobs CSV
                      </button>
                      <button onClick={exportExpensesCSV} title="Download expenses CSV" style={csvBtnStyle}>
                        Expenses CSV
                      </button>
                      <button onClick={exportDuesCSV} title="Download dues CSV" style={csvBtnStyle}>
                        Dues CSV
                      </button>
                    </div>

                    {/* PDF controls */}
                    <button onClick={() => setShowPdfPreview(!showPdfPreview)} style={{
                      display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem",
                      borderRadius: "10px", background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                      color: "var(--foreground)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                    }}>
                      <Eye size={14} /> {showPdfPreview ? "Hide PDF Preview" : "Preview PDF"}
                    </button>
                    <button onClick={handleDownloadPdf} disabled={generatingPdf} style={{
                      display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem",
                      borderRadius: "10px", background: generatingPdf ? "var(--surface-border)" : "linear-gradient(135deg, var(--primary), var(--accent))",
                      border: "none", color: "white", fontSize: "0.8rem", fontWeight: 600,
                      cursor: generatingPdf ? "not-allowed" : "pointer", transition: "all 0.2s"
                    }}>
                      {generatingPdf ? <><Loader size={14} className="spinner" /> Generating...</> : <><Download size={14} /> Download PDF</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* PDF Preview container inside the Ledger view */}
              {showPdfPreview && (
                <div style={{
                  marginBottom: "2rem",
                  padding: "1.5rem",
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(168,85,247,0.3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginBottom: "1rem", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#a855f7" }}>PDF Statement Preview</h4>
                    <button onClick={() => setShowPdfPreview(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}><X size={16} /></button>
                  </div>
                  <div style={{
                    width: "100%",
                    overflowX: "auto",
                    padding: "1rem",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "center"
                  }}>
                    <div style={{
                      background: "white",
                      color: "black",
                      padding: "30px",
                      width: "800px",
                      minWidth: "800px",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      fontFamily: "'Segoe UI', Arial, sans-serif",
                      borderRadius: "8px"
                    }}>
                      {/* PDF Header */}
                      <div style={{ textAlign: "center", marginBottom: "25px", borderBottom: "3px solid #1f481e", paddingBottom: "15px" }}>
                        <h1 style={{ color: "#1f481e", margin: "0 0 5px 0", fontSize: "24px", letterSpacing: "-0.5px" }}>COCOFY</h1>
                        <h2 style={{ margin: "0 0 5px 0", color: "#333", fontSize: "14px", fontWeight: 600, textTransform: "uppercase" }}>
                          {ledgerPeriodType} FINANCIAL STATEMENT
                        </h2>
                        <p style={{ margin: 0, color: "#666", fontSize: "12px" }}>
                          Statement Period: {periodLabel}  ·  Generated: {new Date().toLocaleDateString("en-IN")}
                        </p>
                      </div>

                      {/* PDF Summary */}
                      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "25px", padding: "12px 0", background: "#f8f9fa", borderRadius: "6px" }}>
                        {[
                          { label: "Revenue", value: ledgerRevenue, color: "#10b981" },
                          { label: "Expenses", value: ledgerTotalExpenses, color: "#ef233c" },
                          { label: "Net Profit", value: ledgerRevenue - ledgerTotalExpenses, color: "#3b82f6" },
                          { label: "Total Due", value: ledgerTotalDue, color: "#f59e0b" },
                        ].map((s) => (
                          <div key={s.label} style={{ textAlign: "center" }}>
                            <p style={{ margin: "0 0 4px 0", fontSize: "10px", color: "#888", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</p>
                            <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: s.color }}>₹{s.value.toLocaleString("en-IN")}</p>
                          </div>
                        ))}
                      </div>

                      {/* Conditional Tables */}
                      {ledgerViewMode === "tables" ? (
                        <>
                          {/* Expenses table */}
                          <h3 style={{ color: "#333", fontSize: "12px", margin: "0 0 8px 0", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>📋 Expenses</h3>
                          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "11px" }}>
                            <thead>
                              <tr style={{ background: "#f1f3f5" }}>
                                {["#", "Date", "Type", "Description", "Amount (₹)"].map((h) => (
                                  <th key={h} style={{ padding: "6px 8px", textAlign: h.includes("Amount") ? "right" : "left", borderBottom: "2px solid #dee2e6", fontWeight: 700 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ledgerExpenses.length > 0 ? ledgerExpenses.map((exp, i) => (
                                <tr key={exp.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
                                  <td style={{ padding: "6px 8px", color: "#666" }}>{i + 1}</td>
                                  <td style={{ padding: "6px 8px" }}>{new Date(exp.date).toLocaleDateString("en-IN")}</td>
                                  <td style={{ padding: "6px 8px" }}>{exp.type}</td>
                                  <td style={{ padding: "6px 8px", color: "#666" }}>{exp.description || "—"}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>₹{exp.amount.toLocaleString("en-IN")}</td>
                                </tr>
                              )) : (
                                <tr><td colSpan={5} style={{ padding: "10px", textAlign: "center", color: "#999" }}>No expenses recorded</td></tr>
                              )}
                            </tbody>
                            {ledgerExpenses.length > 0 && (
                              <tfoot>
                                <tr style={{ background: "#f1f3f5", borderTop: "2px solid #dee2e6" }}>
                                  <td colSpan={4} style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>Total:</td>
                                  <td style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right", color: "#dc3545" }}>₹{ledgerTotalExpenses.toLocaleString("en-IN")}</td>
                                </tr>
                              </tfoot>
                            )}
                          </table>

                          {/* Jobs table */}
                          <h3 style={{ color: "#333", fontSize: "12px", margin: "0 0 8px 0", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>🌴 Trees Count & Job Details</h3>
                          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "10px" }}>
                            <thead>
                              <tr style={{ background: "#f1f3f5" }}>
                                {["#", "Date", "Customer", "Location", "Trees", "Price/Tree", "Workers", "Total (₹)", "Status"].map((h) => (
                                  <th key={h} style={{ padding: "6px 6px", textAlign: h.includes("Total") || h === "Trees" || h === "Workers" ? "right" : "left", borderBottom: "2px solid #dee2e6", fontWeight: 700 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ledgerJobs.length > 0 ? ledgerJobs.map((job, i) => {
                                const ppt = parsePrice(job.pricePerTree);
                                return (
                                  <tr key={job.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
                                    <td style={{ padding: "5px 6px", color: "#666" }}>{i + 1}</td>
                                    <td style={{ padding: "5px 6px" }}>{new Date(job.date || job.createdAt).toLocaleDateString("en-IN")}</td>
                                    <td style={{ padding: "5px 6px", fontWeight: 500 }}>{job.customerName}</td>
                                    <td style={{ padding: "5px 6px" }}>{job.location}</td>
                                    <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>{job.trees}</td>
                                    <td style={{ padding: "5px 6px" }}>{job.pricePerTree}</td>
                                    <td style={{ padding: "5px 6px", textAlign: "right" }}>{job.workersRequired}</td>
                                    <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>₹{(job.trees * ppt).toLocaleString("en-IN")}</td>
                                    <td style={{ padding: "5px 6px", fontSize: "9px" }}>{job.status?.replace(/_/g, " ")}</td>
                                  </tr>
                                );
                              }) : (
                                <tr><td colSpan={9} style={{ padding: "10px", textAlign: "center", color: "#999" }}>No jobs recorded</td></tr>
                              )}
                            </tbody>
                            {ledgerJobs.length > 0 && (
                              <tfoot>
                                <tr style={{ background: "#f1f3f5", borderTop: "2px solid #dee2e6" }}>
                                  <td colSpan={4} style={{ padding: "6px 6px", fontWeight: 700, textAlign: "right" }}>Totals:</td>
                                  <td style={{ padding: "6px 6px", fontWeight: 700, textAlign: "right", color: "#198754" }}>{ledgerTotalTrees}</td>
                                  <td colSpan={2} />
                                  <td style={{ padding: "6px 6px", fontWeight: 700, textAlign: "right", color: "#198754" }}>₹{ledgerJobs.reduce((s, j) => s + j.trees * parsePrice(j.pricePerTree), 0).toLocaleString("en-IN")}</td>
                                  <td />
                                </tr>
                              </tfoot>
                            )}
                          </table>

                          {/* Dues table */}
                          <h3 style={{ color: "#333", fontSize: "12px", margin: "0 0 8px 0", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>⚠️ Due Amounts</h3>
                          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "11px" }}>
                            <thead>
                              <tr style={{ background: "#f1f3f5" }}>
                                {["#", "Customer", "Phone", "Location", "Total (₹)", "Paid (₹)", "Due (₹)", "Status"].map((h) => (
                                  <th key={h} style={{ padding: "6px 8px", textAlign: h.includes("₹") ? "right" : "left", borderBottom: "2px solid #dee2e6", fontWeight: 700 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ledgerDues.length > 0 ? ledgerDues.map((p, i) => (
                                <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
                                  <td style={{ padding: "6px 8px", color: "#666" }}>{i + 1}</td>
                                  <td style={{ padding: "6px 8px", fontWeight: 500 }}>{p.jobDetails?.customerName}</td>
                                  <td style={{ padding: "6px 8px" }}>{p.jobDetails?.phone}</td>
                                  <td style={{ padding: "6px 8px" }}>{p.jobDetails?.location}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>₹{(p.totalAmount || 0).toLocaleString("en-IN")}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#198754" }}>₹{(p.paidAmount || 0).toLocaleString("en-IN")}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#dc3545" }}>₹{(p.dueAmount || 0).toLocaleString("en-IN")}</td>
                                  <td style={{ padding: "6px 8px", fontSize: "9px", fontWeight: 600, color: p.paymentStatus === "UNPAID" ? "#dc3545" : "#ffc107" }}>{p.paymentStatus?.replace(/_/g, " ")}</td>
                                </tr>
                              )) : (
                                <tr><td colSpan={8} style={{ padding: "10px", textAlign: "center", color: "#999" }}>No outstanding dues</td></tr>
                              )}
                            </tbody>
                            {ledgerDues.length > 0 && (
                              <tfoot>
                                <tr style={{ background: "#f1f3f5", borderTop: "2px solid #dee2e6" }}>
                                  <td colSpan={6} style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>Total Due:</td>
                                  <td style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right", color: "#dc3545" }}>₹{ledgerTotalDue.toLocaleString("en-IN")}</td>
                                  <td />
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </>
                      ) : (
                        <>
                          {/* Consolidated Cash Flow table */}
                          <h3 style={{ color: "#333", fontSize: "12px", margin: "0 0 8px 0", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>💵 Consolidated Ledger</h3>
                          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "10px" }}>
                            <thead>
                              <tr style={{ background: "#f1f3f5" }}>
                                {["#", "Date", "Type", "Category", "Description", "Ref ID", "Method", "Debit (₹)", "Credit (₹)", "Balance (₹)"].map((h) => (
                                  <th key={h} style={{ padding: "6px 6px", textAlign: h.includes("Debit") || h.includes("Credit") || h.includes("Balance") ? "right" : "left", borderBottom: "2px solid #dee2e6", fontWeight: 700 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {consolidatedLedger.length > 0 ? consolidatedLedger.map((row, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
                                  <td style={{ padding: "5px 6px", color: "#666" }}>{i + 1}</td>
                                  <td style={{ padding: "5px 6px" }}>{row.date.toLocaleDateString("en-IN")}</td>
                                  <td style={{ padding: "5px 6px", fontWeight: 600, color: row.type === "CREDIT" ? "#198754" : row.type === "DEBIT" ? "#dc3545" : "#ffc107" }}>{row.type}</td>
                                  <td style={{ padding: "5px 6px" }}>{row.category}</td>
                                  <td style={{ padding: "5px 6px", color: "#666" }}>{row.description}</td>
                                  <td style={{ padding: "5px 6px", color: "#888" }}>{row.refId ? row.refId.substring(0, 6) : "—"}</td>
                                  <td style={{ padding: "5px 6px" }}>{row.paymentMethod}</td>
                                  <td style={{ padding: "5px 6px", textAlign: "right", color: row.debit > 0 ? "#dc3545" : "#666" }}>{row.debit > 0 ? `₹${row.debit.toLocaleString("en-IN")}` : "—"}</td>
                                  <td style={{ padding: "5px 6px", textAlign: "right", color: row.credit > 0 ? "#198754" : "#666" }}>{row.credit > 0 ? `₹${row.credit.toLocaleString("en-IN")}` : "—"}</td>
                                  <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>₹{row.balance.toLocaleString("en-IN")}</td>
                                </tr>
                              )) : (
                                <tr><td colSpan={10} style={{ padding: "15px", textAlign: "center", color: "#999" }}>No transactions recorded</td></tr>
                              )}
                            </tbody>
                          </table>
                        </>
                      )}

                      {/* PDF Footer */}
                      <div style={{ marginTop: "25px", textAlign: "center", color: "#999", fontSize: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                        <p>Generated by Cocofy Financial Management System</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Cards for Ledger */}
              <div className="grid-stack-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
                {[
                  { label: "Revenue", value: ledgerRevenue, color: "#10b981" },
                  { label: "Expenses", value: ledgerTotalExpenses, color: "#ef233c" },
                  { label: "Net Profit", value: ledgerRevenue - ledgerTotalExpenses, color: "var(--accent)" },
                  { label: "Total Due", value: ledgerTotalDue, color: "#f59e0b" },
                ].map((s) => (
                  <div key={s.label} style={{
                    padding: "1rem 1.25rem", borderRadius: "12px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)"
                  }}>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.3rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>{s.label}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: s.color }}>{fmtFull(s.value)}</div>
                  </div>
                ))}
              </div>

              {/* LEDGER TABLES / CONSOLIDATED VIEW */}
              {ledgerViewMode === "tables" ? (
                <>
                  {/* LEDGER TABLE 1: Expenses */}
                  <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
                    <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Receipt size={16} color="#ef233c" /> Expenses — {periodLabel}
                    </h3>
                    <div className="scroll-table-container" style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "rgba(239,35,60,0.08)" }}>
                            {["#", "Date", "Type", "Description", "Amount (₹)"].map((h) => (
                              <th key={h} style={{ padding: "0.65rem 1rem", textAlign: h.includes("Amount") ? "right" : "left", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerExpenses.length > 0 ? ledgerExpenses.map((exp, i) => (
                            <tr key={exp.id} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "0.6rem 1rem", fontSize: "0.82rem", color: "rgba(255,255,255,0.4)" }}>{i + 1}</td>
                              <td style={{ padding: "0.6rem 1rem", fontSize: "0.82rem" }}>{new Date(exp.date).toLocaleDateString("en-IN")}</td>
                              <td style={{ padding: "0.6rem 1rem", fontSize: "0.82rem" }}>{exp.type}</td>
                              <td style={{ padding: "0.6rem 1rem", fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{exp.description || "—"}</td>
                              <td style={{ padding: "0.6rem 1rem", fontSize: "0.85rem", fontWeight: 600, textAlign: "right" }}>₹{exp.amount.toLocaleString("en-IN")}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>No expenses recorded</td></tr>
                          )}
                        </tbody>
                        {ledgerExpenses.length > 0 && (
                          <tfoot>
                            <tr style={{ background: "rgba(239,35,60,0.06)" }}>
                              <td colSpan={4} style={{ padding: "0.65rem 1rem", fontWeight: 700, textAlign: "right", fontSize: "0.85rem" }}>Total:</td>
                              <td style={{ padding: "0.65rem 1rem", fontWeight: 700, fontSize: "0.95rem", textAlign: "right", color: "#ef233c" }}>₹{ledgerTotalExpenses.toLocaleString("en-IN")}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* LEDGER TABLE 2: Trees & Jobs */}
                  <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
                    <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <TreePine size={16} color="#10b981" /> Trees Count & Job Details — {periodLabel}
                    </h3>
                    <div className="scroll-table-container" style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "rgba(16,185,129,0.08)" }}>
                            {["#", "Date", "Customer", "Location", "Trees", "Price/Tree", "Workers", "Total (₹)", "Status"].map((h) => (
                              <th key={h} style={{ padding: "0.65rem 0.75rem", textAlign: h.includes("Total") || h === "Trees" || h === "Workers" ? "right" : "left", fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerJobs.length > 0 ? ledgerJobs.map((job, i) => {
                            const ppt = parsePrice(job.pricePerTree);
                            const total = job.trees * ppt;
                            return (
                              <tr key={job.id} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>{i + 1}</td>
                                <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem" }}>{new Date(job.date || job.createdAt).toLocaleDateString("en-IN")}</td>
                                <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", fontWeight: 500 }}>{job.customerName}</td>
                                <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem" }}>{job.location}</td>
                                <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", textAlign: "right", fontWeight: 600 }}>{job.trees}</td>
                                <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem" }}>{job.pricePerTree}</td>
                                <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", textAlign: "right" }}>{job.workersRequired}</td>
                                <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", textAlign: "right", fontWeight: 600 }}>₹{total.toLocaleString("en-IN")}</td>
                                <td style={{ padding: "0.6rem 0.75rem" }}>
                                  <span style={{
                                    padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.65rem", fontWeight: 700,
                                    background: job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                                    color: job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED" ? "#10b981" : "#f59e0b",
                                    border: `1px solid ${job.status === "WORK_COMPLETED" || job.status === "COMPLETED" || job.status === "ARCHIVED" ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`
                                  }}>{job.status?.replace(/_/g, " ") || "N/A"}</span>
                                </td>
                              </tr>
                            );
                          }) : (
                            <tr><td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>No jobs recorded</td></tr>
                          )}
                        </tbody>
                        {ledgerJobs.length > 0 && (
                          <tfoot>
                            <tr style={{ background: "rgba(16,185,129,0.06)" }}>
                              <td colSpan={4} style={{ padding: "0.65rem 0.75rem", fontWeight: 700, textAlign: "right", fontSize: "0.85rem" }}>Totals:</td>
                              <td style={{ padding: "0.65rem 0.75rem", fontWeight: 700, textAlign: "right", color: "#10b981" }}>{ledgerTotalTrees}</td>
                              <td colSpan={2} />
                              <td style={{ padding: "0.65rem 0.75rem", fontWeight: 700, textAlign: "right", color: "#10b981", fontSize: "0.95rem" }}>₹{ledgerJobs.reduce((s, j) => s + j.trees * parsePrice(j.pricePerTree), 0).toLocaleString("en-IN")}</td>
                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* LEDGER TABLE 3: Due Amounts */}
                  <div style={{ ...cardStyle, marginBottom: "2rem" }}>
                    <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <AlertTriangle size={16} color="#f59e0b" /> Due Amounts — {periodLabel}
                    </h3>
                    <div className="scroll-table-container" style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "rgba(245,158,11,0.08)" }}>
                            {["#", "Customer", "Phone", "Location", "Total (₹)", "Paid (₹)", "Due (₹)", "Status"].map((h) => (
                              <th key={h} style={{ padding: "0.65rem 0.75rem", textAlign: h.includes("₹") ? "right" : "left", fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerDues.length > 0 ? ledgerDues.map((p, i) => (
                            <tr key={p.id} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>{i + 1}</td>
                              <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", fontWeight: 500 }}>{p.jobDetails?.customerName}</td>
                              <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem" }}>{p.jobDetails?.phone}</td>
                              <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem" }}>{p.jobDetails?.location}</td>
                              <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", textAlign: "right" }}>₹{(p.totalAmount || 0).toLocaleString("en-IN")}</td>
                              <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", textAlign: "right", color: "#10b981" }}>₹{(p.paidAmount || 0).toLocaleString("en-IN")}</td>
                              <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.85rem", textAlign: "right", fontWeight: 700, color: "#ef233c" }}>₹{(p.dueAmount || 0).toLocaleString("en-IN")}</td>
                              <td style={{ padding: "0.6rem 0.75rem" }}>
                                <span style={{
                                  padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.65rem", fontWeight: 700,
                                  background: p.paymentStatus === "UNPAID" ? "rgba(239,35,60,0.12)" : "rgba(245,158,11,0.12)",
                                  color: p.paymentStatus === "UNPAID" ? "#ef233c" : "#f59e0b",
                                  border: `1px solid ${p.paymentStatus === "UNPAID" ? "rgba(239,35,60,0.3)" : "rgba(245,158,11,0.3)"}`
                                }}>{p.paymentStatus?.replace(/_/g, " ")}</span>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>No outstanding dues</td></tr>
                          )}
                        </tbody>
                        {ledgerDues.length > 0 && (
                          <tfoot>
                            <tr style={{ background: "rgba(245,158,11,0.06)" }}>
                              <td colSpan={6} style={{ padding: "0.65rem 0.75rem", fontWeight: 700, textAlign: "right", fontSize: "0.85rem" }}>Total Due:</td>
                              <td style={{ padding: "0.65rem 0.75rem", fontWeight: 700, fontSize: "0.95rem", textAlign: "right", color: "#ef233c" }}>₹{ledgerTotalDue.toLocaleString("en-IN")}</td>
                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                /* LEDGER TABLE: Consolidated Transactions */
                <div style={{ ...cardStyle, marginBottom: "2rem" }}>
                  <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <DollarSign size={16} color="var(--primary)" /> Consolidated Cash Flow Statement — {periodLabel}
                  </h3>
                  <div className="scroll-table-container" style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "rgba(123,44,191,0.08)" }}>
                          {["#", "Date", "Type", "Category", "Description", "Ref ID", "Method", "Debit", "Credit", "Balance"].map((h) => (
                            <th key={h} style={{
                              padding: "0.65rem 0.75rem",
                              textAlign: h.includes("Debit") || h.includes("Credit") || h.includes("Balance") ? "right" : "left",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.6)",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              whiteSpace: "nowrap"
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedLedger.length > 0 ? consolidatedLedger.map((row, i) => (
                          <tr key={i} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>{i + 1}</td>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem" }}>{row.date.toLocaleDateString("en-IN")}</td>
                            <td style={{ padding: "0.6rem 0.75rem" }}>
                              <span style={{
                                padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.65rem", fontWeight: 700,
                                background: row.type === "CREDIT" ? "rgba(16,185,129,0.12)" : row.type === "DEBIT" ? "rgba(239,35,60,0.12)" : "rgba(245,158,11,0.12)",
                                color: row.type === "CREDIT" ? "#10b981" : row.type === "DEBIT" ? "#ef233c" : "#f59e0b",
                                border: `1px solid ${row.type === "CREDIT" ? "rgba(16,185,129,0.3)" : row.type === "DEBIT" ? "rgba(239,35,60,0.3)" : "rgba(245,158,11,0.3)"}`
                              }}>{row.type}</span>
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem" }}>{row.category}</td>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.8)", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis" }}>{row.description}</td>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>{row.refId?.substring(0, 8)}...</td>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem" }}>{row.paymentMethod}</td>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", textAlign: "right", color: row.debit > 0 ? "#ef233c" : "rgba(255,255,255,0.3)" }}>
                              {row.debit > 0 ? `₹${row.debit.toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.8rem", textAlign: "right", color: row.credit > 0 ? "#10b981" : "rgba(255,255,255,0.3)" }}>
                              {row.credit > 0 ? `₹${row.credit.toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, textAlign: "right", color: row.balance >= 0 ? "var(--accent)" : "var(--error)" }}>
                              ₹{row.balance.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={10} style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>No transactions recorded for this period</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ===================================================================
          EXPENSE MODAL
          =================================================================== */}
      {expenseModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => !expSubmitting && setExpenseModalOpen(false)} />
          <div className="mobile-scroll-modal" style={{
            position: "relative", background: "var(--surface)", border: "1px solid var(--surface-border)",
            borderRadius: "20px", width: "100%", maxWidth: "500px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            animation: "modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards", overflow: "hidden"
          }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--surface-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)" }}>
              <h3 style={{ fontSize: "1.15rem", margin: 0, fontWeight: 700 }}>{editingExpense ? "Edit Expense" : "Add Expense"}</h3>
              <button onClick={() => !expSubmitting && setExpenseModalOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={labelStyle}>Expense Type</label>
                <select value={expType} onChange={(e) => setExpType(e.target.value)} style={{ ...inputStyle, width: "100%", cursor: "pointer" }}>
                  {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {expType === "Other" && (
                <div>
                  <label style={labelStyle}>Custom Expense Type</label>
                  <input
                    type="text"
                    value={customExpType}
                    onChange={(e) => setCustomExpType(e.target.value)}
                    placeholder="Enter custom expense type..."
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
              )}
              <div>
                <label style={labelStyle}>Description (Optional)</label>
                <input type="text" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Brief description..." style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div>
                <label style={labelStyle}>Amount (₹)</label>
                <input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="Enter amount" style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <DatePicker value={expDate} onChange={setExpDate} />
              </div>
              <button onClick={handleSaveExpense} disabled={expSubmitting} style={{
                width: "100%", padding: "0.875rem",
                background: expSubmitting ? "var(--surface-border)" : "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                color: "white", border: "none", borderRadius: "12px", fontWeight: 600, fontSize: "1rem",
                cursor: expSubmitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem"
              }}>
                {expSubmitting ? <><div className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} /> Saving...</> : <><Plus size={18} /> {editingExpense ? "Update Expense" : "Add Expense"}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          HIDDEN PDF ELEMENT FOR LEDGER
          =================================================================== */}
      <div ref={ledgerPdfRef} style={{ display: "none", background: "white", color: "black", padding: "40px", width: "900px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        {/* PDF Header */}
        <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "3px solid #1f481e", paddingBottom: "20px" }}>
          <h1 style={{ color: "#1f481e", margin: "0 0 5px 0", fontSize: "28px", letterSpacing: "-0.5px" }}>COCOFY</h1>
          <h2 style={{ margin: "0 0 5px 0", color: "#333", fontSize: "16px", fontWeight: 600, textTransform: "uppercase" }}>{ledgerPeriodType} FINANCIAL STATEMENT</h2>
          <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Statement Period: {periodLabel}  ·  Generated: {new Date().toLocaleDateString("en-IN")}</p>
        </div>

        {/* PDF Summary */}
        <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "30px", padding: "15px 0", background: "#f8f9fa", borderRadius: "8px" }}>
          {[
            { label: "Revenue", value: ledgerRevenue, color: "#10b981" },
            { label: "Expenses", value: ledgerTotalExpenses, color: "#ef233c" },
            { label: "Net Profit", value: ledgerRevenue - ledgerTotalExpenses, color: "#3b82f6" },
            { label: "Total Due", value: ledgerTotalDue, color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#888", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: s.color }}>₹{s.value.toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>

        {/* Conditional PDF Tables */}
        {ledgerViewMode === "tables" ? (
          <>
            {/* PDF Table 1: Expenses */}
            <h3 style={{ color: "#333", fontSize: "14px", margin: "0 0 10px 0", borderBottom: "1px solid #ddd", paddingBottom: "5px" }}>📋 Expenses</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "25px", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f1f3f5" }}>
                  {["#", "Date", "Type", "Description", "Amount (₹)"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h.includes("Amount") ? "right" : "left", borderBottom: "2px solid #dee2e6", fontWeight: 700, color: "#495057" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerExpenses.length > 0 ? ledgerExpenses.map((exp, i) => (
                  <tr key={exp.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
                    <td style={{ padding: "7px 10px", color: "#666" }}>{i + 1}</td>
                    <td style={{ padding: "7px 10px" }}>{new Date(exp.date).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "7px 10px" }}>{exp.type}</td>
                    <td style={{ padding: "7px 10px", color: "#666" }}>{exp.description || "—"}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600 }}>₹{exp.amount.toLocaleString("en-IN")}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} style={{ padding: "15px", textAlign: "center", color: "#999" }}>No expenses recorded</td></tr>
                )}
              </tbody>
              {ledgerExpenses.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f1f3f5", borderTop: "2px solid #dee2e6" }}>
                    <td colSpan={4} style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right" }}>Total:</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right", color: "#dc3545" }}>₹{ledgerTotalExpenses.toLocaleString("en-IN")}</td>
                  </tr>
                </tfoot>
              )}
            </table>

            {/* PDF Table 2: Jobs */}
            <h3 style={{ color: "#333", fontSize: "14px", margin: "0 0 10px 0", borderBottom: "1px solid #ddd", paddingBottom: "5px" }}>🌴 Trees Count & Job Details</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "25px", fontSize: "11px" }}>
              <thead>
                <tr style={{ background: "#f1f3f5" }}>
                  {["#", "Date", "Customer", "Location", "Trees", "Price/Tree", "Workers", "Total (₹)", "Status"].map((h) => (
                    <th key={h} style={{ padding: "8px 8px", textAlign: h.includes("Total") || h === "Trees" || h === "Workers" ? "right" : "left", borderBottom: "2px solid #dee2e6", fontWeight: 700, color: "#495057" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerJobs.length > 0 ? ledgerJobs.map((job, i) => {
                  const ppt = parsePrice(job.pricePerTree);
                  return (
                    <tr key={job.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
                      <td style={{ padding: "6px 8px", color: "#666" }}>{i + 1}</td>
                      <td style={{ padding: "6px 8px" }}>{new Date(job.date || job.createdAt).toLocaleDateString("en-IN")}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 500 }}>{job.customerName}</td>
                      <td style={{ padding: "6px 8px" }}>{job.location}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{job.trees}</td>
                      <td style={{ padding: "6px 8px" }}>{job.pricePerTree}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{job.workersRequired}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>₹{(job.trees * ppt).toLocaleString("en-IN")}</td>
                      <td style={{ padding: "6px 8px", fontSize: "10px" }}>{job.status?.replace(/_/g, " ")}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={9} style={{ padding: "15px", textAlign: "center", color: "#999" }}>No jobs recorded</td></tr>
                )}
              </tbody>
              {ledgerJobs.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f1f3f5", borderTop: "2px solid #dee2e6" }}>
                    <td colSpan={4} style={{ padding: "8px 8px", fontWeight: 700, textAlign: "right" }}>Totals:</td>
                    <td style={{ padding: "8px 8px", fontWeight: 700, textAlign: "right", color: "#198754" }}>{ledgerTotalTrees}</td>
                    <td colSpan={2} />
                    <td style={{ padding: "8px 8px", fontWeight: 700, textAlign: "right", color: "#198754" }}>₹{ledgerJobs.reduce((s, j) => s + j.trees * parsePrice(j.pricePerTree), 0).toLocaleString("en-IN")}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>

            {/* PDF Table 3: Dues */}
            <h3 style={{ color: "#333", fontSize: "14px", margin: "0 0 10px 0", borderBottom: "1px solid #ddd", paddingBottom: "5px" }}>⚠️ Due Amounts</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "25px", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f1f3f5" }}>
                  {["#", "Customer", "Phone", "Location", "Total (₹)", "Paid (₹)", "Due (₹)", "Status"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h.includes("₹") ? "right" : "left", borderBottom: "2px solid #dee2e6", fontWeight: 700, color: "#495057" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerDues.length > 0 ? ledgerDues.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
                    <td style={{ padding: "7px 10px", color: "#666" }}>{i + 1}</td>
                    <td style={{ padding: "7px 10px", fontWeight: 500 }}>{p.jobDetails?.customerName}</td>
                    <td style={{ padding: "7px 10px" }}>{p.jobDetails?.phone}</td>
                    <td style={{ padding: "7px 10px" }}>{p.jobDetails?.location}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right" }}>₹{(p.totalAmount || 0).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: "#198754" }}>₹{(p.paidAmount || 0).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#dc3545" }}>₹{(p.dueAmount || 0).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "7px 10px", fontSize: "10px", fontWeight: 600, color: p.paymentStatus === "UNPAID" ? "#dc3545" : "#ffc107" }}>{p.paymentStatus?.replace(/_/g, " ")}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} style={{ padding: "15px", textAlign: "center", color: "#999" }}>No outstanding dues</td></tr>
                )}
              </tbody>
              {ledgerDues.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f1f3f5", borderTop: "2px solid #dee2e6" }}>
                    <td colSpan={6} style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right" }}>Total Due:</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right", color: "#dc3545" }}>₹{ledgerTotalDue.toLocaleString("en-IN")}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </>
        ) : (
          <>
            {/* PDF Table: Consolidated Statement */}
            <h3 style={{ color: "#333", fontSize: "14px", margin: "0 0 10px 0", borderBottom: "1px solid #ddd", paddingBottom: "5px" }}>💵 Consolidated Ledger</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "25px", fontSize: "10px" }}>
              <thead>
                <tr style={{ background: "#f1f3f5" }}>
                  {["#", "Date", "Type", "Category", "Description", "Ref ID", "Method", "Debit (₹)", "Credit (₹)", "Balance (₹)"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: h.includes("Debit") || h.includes("Credit") || h.includes("Balance") ? "right" : "left", borderBottom: "2px solid #dee2e6", fontWeight: 700, color: "#495057" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consolidatedLedger.length > 0 ? consolidatedLedger.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
                    <td style={{ padding: "6px 8px", color: "#666" }}>{i + 1}</td>
                    <td style={{ padding: "6px 8px" }}>{row.date.toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 600, color: row.type === "CREDIT" ? "#198754" : row.type === "DEBIT" ? "#dc3545" : "#ffc107" }}>{row.type}</td>
                    <td style={{ padding: "6px 8px" }}>{row.category}</td>
                    <td style={{ padding: "6px 8px", color: "#666" }}>{row.description}</td>
                    <td style={{ padding: "6px 8px", color: "#888" }}>{row.refId ? row.refId.substring(0, 6) : "—"}</td>
                    <td style={{ padding: "6px 8px" }}>{row.paymentMethod}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: row.debit > 0 ? "#dc3545" : "#666" }}>{row.debit > 0 ? `₹${row.debit.toLocaleString("en-IN")}` : "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: row.credit > 0 ? "#198754" : "#666" }}>{row.credit > 0 ? `₹${row.credit.toLocaleString("en-IN")}` : "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>₹{row.balance.toLocaleString("en-IN")}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={10} style={{ padding: "15px", textAlign: "center", color: "#999" }}>No transactions recorded for this period</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* PDF Footer */}
        <div style={{ marginTop: "30px", textAlign: "center", color: "#999", fontSize: "11px", borderTop: "1px solid #eee", paddingTop: "15px" }}>
          <p>Generated by Cocofy Financial Management System</p>
          <p>This is a computer-generated document and does not require a physical signature.</p>
        </div>
      </div>

      {/* ===================================================================
          STYLES
          =================================================================== */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalIn {
          0% { transform: scale(0.9) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.1; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmerCard {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .kpi-card {
          animation: fadeInUp 0.6s ease forwards;
          position: relative;
          overflow: hidden;
        }
        .kpi-card::after {
          content: '';
          position: absolute;
          top: 0; left: -150%; width: 50%; height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-25deg);
          transition: none; pointer-events: none;
        }
        .kpi-card:hover::after {
          left: 150%;
          transition: left 0.8s cubic-bezier(0.16,1,0.3,1);
        }
        .kpi-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px var(--primary-glow);
          border-color: var(--primary-glow-border) !important;
        }
        select option {
          background: var(--surface-2);
          color: var(--foreground);
        }
      ` }} />
    </div>
  );
}

/* ============================== SUB-COMPONENTS ============================== */
function KPICard({ label, value, icon, color, change }: {
  label: string; value: number; icon: React.ReactNode; color: string; change?: number;
}) {
  return (
    <div className="kpi-card" style={{
      padding: "1.25rem 1.5rem", borderRadius: "16px",
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      transition: "all 0.4s cubic-bezier(0.175,0.885,0.32,1.275)",
      cursor: "default"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div style={{
          width: "42px", height: "42px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
          background: `${color}18`, border: `1px solid ${color}35`,
        }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {change !== undefined && change !== 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600,
            color: change >= 0 ? "#10b981" : "#ef233c",
            padding: "0.2rem 0.5rem", borderRadius: "6px",
            background: change >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,35,60,0.1)"
          }}>
            {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color, letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>
        ₹{value.toLocaleString("en-IN")}
      </div>
      <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

/* ============================== STYLE CONSTANTS ============================== */
const cardStyle: React.CSSProperties = {
  padding: "1.5rem",
  borderRadius: "16px",
  background: "var(--surface-1)",
  border: "1px solid var(--surface-border)",
  backdropFilter: "blur(8px)"
};

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.85rem",
  borderRadius: "8px",
  background: "var(--surface-2)",
  border: "1px solid var(--surface-border)",
  color: "var(--foreground)",
  fontSize: "0.85rem",
  outline: "none",
  fontFamily: "inherit"
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.82rem",
  fontWeight: 550,
  color: "var(--text-muted)",
  marginBottom: "0.4rem"
};

const csvBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.75rem",
  borderRadius: "8px",
  background: "transparent",
  border: "none",
  color: "var(--text-muted)",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
  display: "flex",
  alignItems: "center",
  gap: "0.25rem"
};
