"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  required?: boolean;
  name?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function DatePicker({ value, onChange, required, name }: DatePickerProps) {
  const today = new Date();
  const selected = parseDate(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position popover using fixed coords so it escapes modal overflow:hidden
  const positionPopover = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPOVER_W = 340;
    const POPOVER_H = 540;   // real rendered height (header + days + grid + footer)
    const GAP = 12;
    const MIN_TOP = 16;      // never closer than 16px to top of viewport

    let left = rect.left;
    let top = rect.bottom + GAP;

    // Prevent overflow right
    if (left + POPOVER_W > window.innerWidth - 12) {
      left = window.innerWidth - POPOVER_W - 12;
    }
    // Prefer below; flip above only if not enough room below
    if (top + POPOVER_H > window.innerHeight - 12) {
      const topAbove = rect.top - POPOVER_H - GAP;
      // Only flip if there's actually room above, otherwise just nudge down
      top = topAbove >= MIN_TOP ? topAbove : Math.max(MIN_TOP, window.innerHeight - POPOVER_H - 12);
    }
    // Final safety clamp — never cut off at top
    top = Math.max(MIN_TOP, top);

    setPopoverStyle({ top, left, width: POPOVER_W });
  }, []);

  const openPicker = () => {
    positionPopover();
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handle = () => positionPopover();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open, positionPopover]);

  const navigate = useCallback((dir: "prev" | "next") => {
    setAnimDir(dir === "prev" ? "right" : "left");
    setAnimKey((k) => k + 1);

    if (dir === "prev") {
      setViewMonth((m) => {
        if (m === 0) {
          setViewYear((y) => y - 1);
          return 11;
        }
        return m - 1;
      });
    } else {
      setViewMonth((m) => {
        if (m === 11) {
          setViewYear((y) => y + 1);
          return 0;
        }
        return m + 1;
      });
    }
  }, [setViewMonth, setViewYear]);

  // Build grid — only current month days; empty slots for prev/next
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  type Cell = { day: number; isCurrent: boolean; date: Date } | null;
  const cells: Cell[] = [];

  for (let i = 0; i < firstDay; i++) cells.push(null); // empty prev-month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrent: true, date: new Date(viewYear, viewMonth, d) });
  }
  // Pad to complete last row (no next-month dates shown)
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (date: Date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const isSelected = (date: Date) =>
    !!selected &&
    date.getFullYear() === selected.getFullYear() &&
    date.getMonth() === selected.getMonth() &&
    date.getDate() === selected.getDate();

  const handleSelect = (cell: NonNullable<Cell>) => {
    onChange(toISO(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate()));
    setOpen(false);
  };

  const displayValue = selected
    ? selected.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  const popoverContent = (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        zIndex: 99999,
        ...popoverStyle,
        background: "var(--surface)",
        border: "1px solid var(--surface-border)",
        borderRadius: "18px",
        boxShadow: "var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.06)",
        backdropFilter: "blur(24px)",
        overflow: "hidden",
        animation: "dp-fade-in 0.18s cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 1rem 0.8rem",
        borderBottom: "1px solid var(--surface-border)",
      }}>
        <button
          type="button"
          onClick={() => navigate("prev")}
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--surface-border)",
            color: "var(--text-light)",
            borderRadius: "9px",
            width: "34px", height: "34px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-light)"; }}
        >
          <ChevronLeft size={15} />
        </button>

        <span style={{
          fontWeight: 700,
          fontSize: "0.95rem",
          background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "0.03em",
          userSelect: "none",
        }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          onClick={() => navigate("next")}
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--surface-border)",
            color: "var(--text-light)",
            borderRadius: "9px",
            width: "34px", height: "34px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-light)"; }}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day labels */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        padding: "0.65rem 0.85rem 0.2rem",
        gap: "4px",
      }}>
        {DAYS.map((d) => (
          <div key={d} style={{
            textAlign: "center",
            fontSize: "0.68rem",
            fontWeight: 700,
            color: "var(--text-light)",
            letterSpacing: "0.06em",
            paddingBottom: "2px",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        key={animKey}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          padding: "0 0.85rem 0.75rem",
          animation: animDir ? `dp-slide-${animDir} 0.2s cubic-bezier(0.22,1,0.36,1) both` : "none",
        }}
      >
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={i} />;
          }
          const sel = isSelected(cell.date);
          const tod = isToday(cell.date);
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(cell)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1",
                borderRadius: "9px",
                border: tod && !sel
                  ? "1.5px solid var(--primary)"
                  : "1.5px solid transparent",
                background: sel
                  ? "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)"
                  : "transparent",
                color: sel ? "white" : tod ? "var(--primary)" : "var(--foreground)",
                fontSize: "0.82rem",
                fontWeight: sel ? 700 : tod ? 600 : 400,
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s, transform 0.1s",
                boxShadow: sel ? "0 4px 14px rgba(124,58,237,0.45)" : "none",
                transform: sel ? "scale(1.08)" : "scale(1)",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                if (!sel) {
                  e.currentTarget.style.background = "var(--surface-2)";
                  e.currentTarget.style.color = "var(--primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!sel) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = tod ? "var(--primary)" : "var(--foreground)";
                }
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.6rem 1rem 0.85rem",
        borderTop: "1px solid var(--surface-border)",
      }}>
        <button
          type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-light)",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: "6px",
            transition: "color 0.15s",
            outline: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-light)")}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(toISO(today.getFullYear(), today.getMonth(), today.getDate()));
            setViewYear(today.getFullYear());
            setViewMonth(today.getMonth());
            setOpen(false);
          }}
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
            border: "none",
            color: "white",
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: "pointer",
            padding: "5px 16px",
            borderRadius: "7px",
            boxShadow: "0 2px 10px rgba(124,58,237,0.4)",
            letterSpacing: "0.03em",
            transition: "opacity 0.15s",
            outline: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Today
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes dp-slide-left {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes dp-slide-right {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes dp-fade-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>

      {/* Hidden native input for form submit / required validation */}
      <input type="hidden" name={name} value={value} required={required} />

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface-2)",
          border: `1.5px solid ${open ? "var(--primary)" : "var(--surface-border)"}`,
          boxShadow: open ? "0 0 0 3px rgba(124,58,237,0.22)" : "none",
          color: displayValue ? "var(--foreground)" : "var(--text-light)",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          outline: "none",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          cursor: "pointer",
          transition: "border-color 0.2s, box-shadow 0.2s",
          letterSpacing: "0.01em",
        }}
      >
        <span>{displayValue || "Select a date"}</span>
        <CalendarDays
          size={16}
          style={{
            color: open ? "var(--primary)" : "var(--text-light)",
            transition: "color 0.2s",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Portal — renders outside modal so overflow:hidden can't clip it */}
      {open && typeof document !== "undefined" && createPortal(popoverContent, document.body)}
    </>
  );
}
