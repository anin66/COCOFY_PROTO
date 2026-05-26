"use client";

import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import {
  ChevronLeft, ChevronRight, Calendar, MapPin, Clock,
  TreePine, Users, Phone, Briefcase, CheckCircle, Truck,
  FileText, XCircle,
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

/* ─── Types ─── */
interface Job {
  id: string;
  customerName: string;
  phone: string;
  location: string;
  date: string;        // "YYYY-MM-DD"
  trees: number;
  workersRequired: number;
  pricePerTree: string;
  status: string;
  time?: string;
  assignedWorkers?: { uid: string; name: string; status: string }[];
  assignedDelivery?: { uid: string; name: string; status: string } | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const STATUS_COLORS: Record<string, string> = {
  UNCONFIRMED: "#d97706",
  CONFIRMED: "#10b981",
  TEAM_PENDING: "#f59e0b",
  TEAM_READY: "#10b981",
  DELIVERY_PENDING: "#3b82f6",
  ACTIVE: "#10b981",
  COMPLETED: "#6b7280",
};

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ─── Component ─── */
export default function SchedulingPage() {
  const router = useRouter();
  const [currentUserName, setCurrentUserName] = useState("Manager");
  const [currentUserRole, setCurrentUserRole] = useState("manager");
  const today = new Date();
  const [jobs, setJobs] = useState<Job[]>([]);
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

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(
    toKey(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const [animKey, setAnimKey] = useState(0);

  /* Real-time jobs listener */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "jobs"), (snap) => {
      const list: Job[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Job));
      setJobs(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  /* Jobs indexed by date */
  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    jobs.forEach((j) => {
      if (!j.date) return;
      // Normalize "YYYY-MM-DD" — the date field may already be in this format
      const key = j.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(j);
    });
    return map;
  }, [jobs]);

  /* Calendar grid */
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  type Cell = { day: number; key: string } | null;
  const cells: Cell[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: toKey(viewYear, viewMonth, d) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  /* Month navigation */
  const navigate = (dir: "prev" | "next") => {
    setAnimDir(dir === "prev" ? "right" : "left");
    setAnimKey((k) => k + 1);
    if (dir === "prev") {
      if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
      else setViewMonth((m) => m - 1);
    } else {
      if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
      else setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(todayKey);
    setAnimDir(null);
    setAnimKey((k) => k + 1);
  };

  /* Stats */
  const monthJobs = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    return jobs.filter((j) => j.date?.startsWith(prefix));
  }, [jobs, viewYear, viewMonth]);

  const todayJobs = jobsByDate[todayKey] || [];

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (!j.date) return false;
      const d = new Date(j.date + "T00:00:00");
      return d >= weekStart && d <= weekEnd;
    });
  }, [jobs, weekStart.toISOString(), weekEnd.toISOString()]);

  /* Selected day jobs */
  const selectedJobs = jobsByDate[selectedDate] || [];

  const selectedDateObj = selectedDate ? new Date(selectedDate + "T00:00:00") : today;
  const selectedDateLabel = selectedDateObj.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar title="Scheduling" />

        <div className="sched-page-container" style={{ padding: "1.5rem 2rem", flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* ─── Stats Row ─── */}
          <div className="sched-stats-container" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {[
              { label: "This Month", value: monthJobs.length, icon: <Calendar size={20} />, color: "var(--primary)", bg: "var(--primary-glow)", border: "var(--primary-glow-border)" },
              { label: "Today", value: todayJobs.length, icon: <Clock size={20} />, color: "var(--accent)", bg: "var(--accent-glow)", border: "var(--accent-glow-border)" },
              { label: "This Week", value: weekJobs.length, icon: <Briefcase size={20} />, color: "var(--success)", bg: "var(--success-glow)", border: "var(--success-glow-border)" },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                borderRadius: "14px", padding: "1.25rem 1.5rem",
                display: "flex", alignItems: "center", gap: "1rem",
                transition: "transform 0.3s, box-shadow 0.3s",
              }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "12px",
                  background: stat.bg, border: `1px solid ${stat.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: stat.color,
                }}>
                  {stat.icon}
                </div>
                <div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stat.value}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-light)", fontWeight: 500 }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Main Area: Calendar + Detail Panel ─── */}
          <div className="sched-main-container" style={{ display: "flex", gap: "1.5rem", flex: 1, minHeight: 0 }}>

            {/* ═══ Calendar ═══ */}
            <div className="sched-calendar-panel" style={{
              flex: "0 0 65%", background: "var(--surface)",
              border: "1px solid var(--surface-border)", borderRadius: "18px",
              padding: "1.5rem", display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }} className="sched-calendar-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <button onClick={() => navigate("prev")} className="btn-nav-arrow"><ChevronLeft size={18} /></button>
                  <h3 className="sched-month-title">
                    {MONTHS[viewMonth]} {viewYear}
                  </h3>
                  <button onClick={() => navigate("next")} className="btn-nav-arrow"><ChevronRight size={18} /></button>
                </div>
                <button onClick={goToday} style={{
                  padding: "0.45rem 1rem", borderRadius: "8px",
                  background: "linear-gradient(135deg, var(--primary), var(--accent))",
                  color: "white", border: "none", fontWeight: 600, fontSize: "0.8rem",
                  cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.02em",
                }}>
                  Today
                </button>
              </div>

              {/* Day-of-week headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px", marginBottom: "0.5rem" }}>
                {DAYS.map((d) => (
                  <div key={d} style={{
                    textAlign: "center", fontSize: "0.75rem", fontWeight: 700,
                    color: "var(--text-light)", letterSpacing: "0.06em", padding: "0.4rem 0",
                  }}>{d}</div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div
                key={animKey}
                className="calendar-grid"
                style={{
                  display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  flex: 1,
                  animation: animDir ? `sched-slide-${animDir} 0.25s cubic-bezier(0.22,1,0.36,1) both` : "none",
                }}
              >
                {cells.map((cell, i) => {
                  if (!cell) return <div key={i} />;
                  const isToday = cell.key === todayKey;
                  const isSelected = cell.key === selectedDate;
                  const dayJobs = jobsByDate[cell.key] || [];
                  const hasJobs = dayJobs.length > 0;

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(cell.key)}
                      className={`calendar-day-btn${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
                    >
                      <span>{cell.day}</span>
                      {/* Status dots */}
                      {hasJobs && (
                        <div style={{ display: "flex", gap: "3px", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                          {dayJobs.length <= 3 ? (
                            dayJobs.map((j, idx) => (
                              <div key={idx} style={{
                                width: "6px", height: "6px", borderRadius: "50%",
                                background: STATUS_COLORS[j.status] || "#6b7280",
                              }} />
                            ))
                          ) : (
                            <>
                              {dayJobs.slice(0, 2).map((j, idx) => (
                                <div key={idx} style={{
                                  width: "6px", height: "6px", borderRadius: "50%",
                                  background: STATUS_COLORS[j.status] || "#6b7280",
                                }} />
                              ))}
                              <span style={{ fontSize: "0.6rem", color: "var(--text-light)", fontWeight: 600 }}>
                                +{dayJobs.length - 2}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ═══ Day Detail Panel ═══ */}
            <div className="sched-details-panel" style={{
              flex: "0 0 35%", background: "var(--surface)",
              border: "1px solid var(--surface-border)", borderRadius: "18px",
              padding: "1.5rem", display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* Panel Header */}
              <div style={{ marginBottom: "1.25rem", flexShrink: 0 }}>
                <h4 style={{
                  margin: 0, fontSize: "1.05rem", fontWeight: 700,
                  background: "var(--header-gradient)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  {selectedDateLabel}
                </h4>
                <p style={{ margin: "0.3rem 0 0", fontSize: "0.8rem", color: "var(--text-light)" }}>
                  {selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""} scheduled
                </p>
              </div>

              {/* Job list */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {loading ? (
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: "3rem" }}>
                    <div className="spinner" style={{ width: "32px", height: "32px", borderWidth: "3px" }} />
                  </div>
                ) : selectedJobs.length === 0 ? (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", flex: 1, gap: "0.75rem",
                    color: "var(--text-dim)", textAlign: "center",
                  }}>
                    <Calendar size={40} strokeWidth={1.5} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>No jobs scheduled</span>
                    <span style={{ fontSize: "0.75rem" }}>Select a day with dots to see details</span>
                  </div>
                ) : (
                  selectedJobs.map((job, idx) => {
                    const sc = STATUS_COLORS[job.status] || "#6b7280";
                    const accepted = job.assignedWorkers?.filter((w) => w.status === "accepted").length || 0;
                    return (
                      <div
                        key={job.id}
                        className="sched-job-card"
                        style={{
                          padding: "1rem 1.1rem", borderRadius: "14px",
                          background: "var(--surface-2)", border: "1px solid var(--surface-border)",
                          animation: `sched-card-in 0.35s ${idx * 0.06}s cubic-bezier(0.22,1,0.36,1) both`,
                        }}
                      >
                        {/* Status + Name row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                          <h5 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{job.customerName}</h5>
                          <div style={{
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            padding: "0.2rem 0.5rem", borderRadius: "100px",
                            background: `${sc}15`, border: `1px solid ${sc}35`,
                            fontSize: "0.62rem", fontWeight: 600, color: sc,
                            letterSpacing: "0.04em",
                          }}>
                            {job.status === "ACTIVE" ? <CheckCircle size={10} /> :
                             job.status === "DELIVERY_PENDING" ? <Truck size={10} /> :
                             job.status === "TEAM_PENDING" ? <Users size={10} /> :
                             <FileText size={10} />}
                            {job.status.replace("_", " ")}
                          </div>
                        </div>

                        {/* Details */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <MapPin size={12} color="var(--accent)" /> {job.location}
                          </div>
                          {job.time && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <Clock size={12} color="var(--accent)" />
                              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{job.time}</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <TreePine size={12} color="var(--accent)" /> {job.trees} tree{job.trees !== 1 ? "s" : ""}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <Users size={12} color="var(--accent)" />
                            <span style={{ color: "var(--accent)", fontWeight: 600 }}>{accepted}/{job.workersRequired}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Animations & Layout Overrides ─── */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes sched-slide-left {
            from { opacity: 0; transform: translateX(24px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes sched-slide-right {
            from { opacity: 0; transform: translateX(-24px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes sched-card-in {
            from { opacity: 0; transform: translateY(12px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          
          .sched-job-card {
            transition: transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275),
                        box-shadow 0.3s ease, border-color 0.2s ease;
          }
          .sched-job-card:hover {
            transform: translateY(-4px) scale(1.01);
            border-color: var(--accent) !important;
            box-shadow: 0 12px 28px -8px var(--primary-glow-border);
          }
          
          .btn-nav-arrow {
            background: var(--surface-2) !important;
            border: 1px solid var(--surface-border) !important;
            color: var(--foreground) !important;
            border-radius: 10px;
            width: 36px; height: 36px;
            display: flex; alignItems: center; justifyContent: center;
            cursor: pointer; transition: all 0.2s ease;
          }
          .btn-nav-arrow:hover {
            background: var(--primary-glow) !important;
            border-color: var(--primary) !important;
            color: var(--primary) !important;
          }
          
          .calendar-day-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 0.5rem 0.25rem;
            gap: 4px;
            border-radius: 12px;
            cursor: pointer;
            border: 2px solid transparent;
            background: transparent;
            color: var(--foreground);
            font-weight: 400;
            font-size: 0.9rem;
            font-family: inherit;
            outline: none;
            transition: all 0.2s ease;
            min-height: 60px;
          }
          .calendar-day-btn:hover {
            background: var(--surface-2);
            transform: translateY(-2px);
          }
          .calendar-day-btn.selected {
            background: var(--primary) !important;
            color: white !important;
            border-color: var(--primary) !important;
            box-shadow: 0 4px 20px var(--primary-glow-border) !important;
            font-weight: 700;
          }
          .calendar-day-btn.today {
            border-color: var(--accent) !important;
            color: var(--accent);
            font-weight: 600;
          }
          .calendar-day-btn.today.selected {
            border-color: var(--primary) !important;
            color: white !important;
          }
          
          .sched-month-title {
            font-size: 1.2rem;
            font-weight: 700;
            margin: 0;
            min-width: 150px;
            text-align: center;
            background: var(--header-gradient);
            WebkitBackgroundClip: text;
            WebkitTextFillColor: transparent;
          }
          
          .calendar-grid {
            gap: 4px;
          }
          
          @media (max-width: 1150px) {
            .sched-page-container {
              padding: 0.5rem !important;
              gap: 0.75rem !important;
            }
            .sched-stats-container {
              grid-template-columns: 1fr !important;
              gap: 0.75rem !important;
            }
            .sched-main-container {
              flex-direction: column !important;
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              gap: 1rem !important;
            }
            .sched-calendar-panel {
              flex: none !important;
              width: 100% !important;
              padding: 0.5rem !important;
            }
            /* Stack calendar header items vertically to prevent overflow */
            .sched-calendar-header {
              flex-direction: column !important;
              gap: 0.75rem !important;
              align-items: center !important;
            }
            .sched-calendar-header > div:first-child {
              justify-content: center !important;
              width: 100% !important;
            }
            .sched-month-title {
              min-width: 120px !important;
              font-size: 1.05rem !important;
            }
            .calendar-grid {
              gap: 2px !important;
            }
            /* Make day cells smaller and more compact on mobile */
            .calendar-day-btn {
              padding: 0.25rem 0.05rem !important;
              min-height: 44px !important;
              font-size: 0.75rem !important;
              border-radius: 6px !important;
            }
            .sched-details-panel {
              flex: none !important;
              width: 100% !important;
              max-height: 450px !important;
              padding: 0.75rem !important;
            }
          }
        `}} />
      </main>
    </div>
  );
}
