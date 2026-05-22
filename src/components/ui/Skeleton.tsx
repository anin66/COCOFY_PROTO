"use client";

import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = "8px",
  style,
  className = "",
}: SkeletonProps) {
  const customStyles: React.CSSProperties = {
    width,
    height,
    borderRadius,
    ...style,
  };

  return <div className={`skeleton ${className}`} style={customStyles} />;
}

export function SkeletonCard() {
  return (
    <div
      className="glass-card"
      style={{
        padding: "1.5rem",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        height: "220px",
        justifyContent: "space-between",
        border: "1px solid var(--surface-border)",
        background: "var(--surface-2)",
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Skeleton width="80px" height="1.25rem" borderRadius="100px" />
        <Skeleton width="60px" height="1.25rem" borderRadius="100px" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, marginTop: "0.5rem" }}>
        <Skeleton width="85%" height="1.5rem" />
        <Skeleton width="45%" height="1rem" style={{ marginTop: "0.25rem" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Skeleton width="90%" height="0.8rem" />
        <Skeleton width="70%" height="0.8rem" />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <Skeleton width="50%" height="2.25rem" borderRadius="8px" />
        <Skeleton width="50%" height="2.25rem" borderRadius="8px" />
      </div>
    </div>
  );
}

export function SkeletonMetrics({ count = 3 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
        gap: "1.5rem",
        width: "100%",
        marginBottom: "2rem",
      }}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="glass-card"
          style={{
            padding: "1.5rem",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            border: "1px solid var(--surface-border)",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Skeleton width="40%" height="1rem" />
            <Skeleton width="28px" height="28px" borderRadius="8px" />
          </div>
          <Skeleton width="60%" height="2.25rem" style={{ margin: "0.25rem 0" }} />
          <Skeleton width="75%" height="0.8rem" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "16px",
        border: "1px solid var(--surface-border)",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--surface-border)" }}>
        <Skeleton width="30%" height="1.25rem" />
      </div>
      <div className="scroll-table-container" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(0,0,0,0.1)" }}>
              {Array.from({ length: cols }).map((_, cIdx) => (
                <th key={cIdx} style={{ padding: "1rem 1.5rem", textAlign: cIdx === cols - 1 ? "right" : "left" }}>
                  <Skeleton width={cIdx === cols - 1 ? "40px" : "80px"} height="0.8rem" style={{ marginLeft: cIdx === cols - 1 ? "auto" : "0" }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} style={{ borderBottom: "1px solid var(--surface-border)" }}>
                {Array.from({ length: cols }).map((_, cIdx) => (
                  <td key={cIdx} style={{ padding: "1.25rem 1.5rem", textAlign: cIdx === cols - 1 ? "right" : "left" }}>
                    <Skeleton
                      width={
                        cIdx === 0
                          ? "100px"
                          : cIdx === cols - 1
                          ? "50px"
                          : cIdx === 1
                          ? "140px"
                          : "80px"
                      }
                      height="1rem"
                      style={{ marginLeft: cIdx === cols - 1 ? "auto" : "0" }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
