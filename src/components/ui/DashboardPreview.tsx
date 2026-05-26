"use client";

import React, { useState, useEffect } from "react";
import { MapPin, TrendingUp, Clock, Navigation, CheckCircle2, ShieldAlert } from "lucide-react";

export default function DashboardPreview() {
  const [activeDriver, setActiveDriver] = useState(0);
  const [pulsate, setPulsate] = useState(true);

  // Rotate active driver highlights for micro-interaction/live feel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDriver((prev) => (prev + 1) % 3);
      setPulsate(false);
      setTimeout(() => setPulsate(true), 50);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const drivers = [
    { name: "A. Ibrahim", route: "Sector 4 → Hub B", status: "In Transit", eta: "4 mins", progress: 65, color: "var(--accent)" },
    { name: "M. Chen", route: "West Station → Hub A", status: "Loading", eta: "Ready", progress: 100, color: "var(--success)" },
    { name: "K. Mensah", route: "South Terminal → Sector 9", status: "Delayed", eta: "12 mins", progress: 40, color: "var(--error)" }
  ];

  return (
    <div className="glass-panel animate-fade-in" style={{
      width: "100%",
      maxWidth: "520px",
      padding: "1.5rem",
      borderRadius: "20px",
      background: "rgba(9, 18, 9, 0.4)",
      border: "1px solid var(--surface-border)",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px var(--primary-glow)",
      position: "relative",
      overflow: "hidden",
      fontFamily: "var(--font-sans)"
    }}>
      {/* Browser Window Header Mock */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--surface-border)",
        paddingBottom: "1rem",
        marginBottom: "1.25rem"
      }}>
        <div style={{ display: "flex", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef233c", opacity: 0.8 }}></span>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", opacity: 0.8 }}></span>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", opacity: 0.8 }}></span>
        </div>
        <div style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "2px",
          color: "var(--text-light)",
          fontFamily: "monospace"
        }}>
          COCOFY_COMMAND // ACTIVE_SESSION
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--accent)" }}>
          <span className="spinner" style={{ width: "10px", height: "10px", borderWidth: "1.5px" }}></span>
          LIVE
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "0.75rem",
        marginBottom: "1.25rem"
      }}>
        {/* KPI 1 */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--surface-border)",
          borderRadius: "10px",
          padding: "0.75rem",
          textAlign: "center"
        }}>
          <div style={{ display: "flex", justifyContent: "center", color: "var(--accent)", marginBottom: "0.25rem" }}>
            <Navigation size={16} />
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>148</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>Active Runs</div>
        </div>

        {/* KPI 2 */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--surface-border)",
          borderRadius: "10px",
          padding: "0.75rem",
          textAlign: "center"
        }}>
          <div style={{ display: "flex", justifyContent: "center", color: "var(--success)", marginBottom: "0.25rem" }}>
            <CheckCircle2 size={16} />
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>99.2%</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>On Time</div>
        </div>

        {/* KPI 3 */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--surface-border)",
          borderRadius: "10px",
          padding: "0.75rem",
          textAlign: "center"
        }}>
          <div style={{ display: "flex", justifyContent: "center", color: "var(--primary)", marginBottom: "0.25rem" }}>
            <TrendingUp size={16} />
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>$1.8K</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>Total Rev</div>
        </div>
      </div>

      {/* Simulated Live Map / Delivery Route Graphic */}
      <div style={{
        background: "rgba(0, 0, 0, 0.2)",
        border: "1px solid var(--surface-border)",
        borderRadius: "12px",
        height: "140px",
        position: "relative",
        overflow: "hidden",
        marginBottom: "1.25rem"
      }}>
        {/* Vector map lines */}
        <svg style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
          {/* Grid lines */}
          <path d="M 0,35 L 600,35" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          <path d="M 0,70 L 600,70" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          <path d="M 0,105 L 600,105" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          <path d="M 120,0 L 120,150" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          <path d="M 240,0 L 240,150" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          <path d="M 360,0 L 360,150" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          
          {/* Active routes */}
          <path d="M 40,110 Q 150,20 280,60 T 460,80" fill="none" stroke="rgba(46, 125, 50, 0.2)" strokeWidth="3" />
          <path d="M 40,110 Q 150,20 280,60 T 460,80" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="6,4" />

          <path d="M 80,20 Q 220,120 380,40" fill="none" stroke="rgba(132, 204, 22, 0.2)" strokeWidth="3" />
          <path d="M 80,20 Q 220,120 380,40" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4,4" />
        </svg>

        {/* Pulsating Map Node Hubs */}
        {/* Hub A */}
        <div style={{ position: "absolute", left: "40px", top: "110px", transform: "translate(-50%, -50%)" }}>
          <span style={{ position: "absolute", display: "inline-flex", borderRadius: "50%", height: "20px", width: "20px", backgroundColor: "var(--primary)", opacity: 0.15, transform: "scale(1.5)" }}></span>
          <span style={{ position: "relative", display: "inline-flex", borderRadius: "50%", height: "8px", width: "8px", backgroundColor: "var(--primary)" }}></span>
          <span style={{ position: "absolute", left: "12px", top: "-6px", fontSize: "9px", fontFamily: "monospace", color: "var(--text-light)" }}>HUB_A</span>
        </div>

        {/* Hub B */}
        <div style={{ position: "absolute", left: "280px", top: "60px", transform: "translate(-50%, -50%)" }}>
          <span style={{ position: "absolute", display: "inline-flex", borderRadius: "50%", height: "20px", width: "20px", backgroundColor: "var(--accent)", opacity: 0.15, transform: "scale(1.5)" }}></span>
          <span style={{ position: "relative", display: "inline-flex", borderRadius: "50%", height: "8px", width: "8px", backgroundColor: "var(--accent)" }}></span>
          <span style={{ position: "absolute", left: "12px", top: "-6px", fontSize: "9px", fontFamily: "monospace", color: "var(--text-light)" }}>SECTOR_4</span>
        </div>

        {/* Hub C (Destination) */}
        <div style={{ position: "absolute", left: "460px", top: "80px", transform: "translate(-50%, -50%)" }}>
          <span style={{ position: "absolute", display: "inline-flex", borderRadius: "50%", height: "24px", width: "24px", backgroundColor: "var(--accent)", opacity: 0.2, animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite" }}></span>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", height: "12px", width: "12px", backgroundColor: "var(--accent)" }}>
            <MapPin size={8} color="#000" />
          </div>
          <span style={{ position: "absolute", left: "16px", top: "-6px", fontSize: "9px", fontWeight: 700, fontFamily: "monospace", color: "var(--accent)" }}>HUB_B</span>
        </div>

        {/* Moving truck indicator */}
        <div style={{
          position: "absolute",
          left: activeDriver === 0 ? "180px" : activeDriver === 1 ? "240px" : "120px",
          top: activeDriver === 0 ? "35px" : activeDriver === 1 ? "80px" : "60px",
          transform: "translate(-50%, -50%)",
          transition: "left 3.9s linear, top 3.9s linear",
          background: "#000",
          border: "1px solid var(--accent)",
          borderRadius: "4px",
          padding: "2px 4px",
          display: "flex",
          alignItems: "center",
          gap: "2px",
          boxShadow: "0 2px 8px rgba(132, 204, 22, 0.4)"
        }}>
          <Navigation size={8} style={{ transform: "rotate(45deg)", color: "var(--accent)" }} />
          <span style={{ fontSize: "7px", fontWeight: 800, color: "var(--accent)" }}>TRK_09</span>
        </div>
      </div>

      {/* Driver List Section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "0.25rem" }}>
          Active Shipments
        </div>

        {drivers.map((driver, idx) => {
          const isActive = idx === activeDriver;
          return (
            <div
              key={driver.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem",
                borderRadius: "8px",
                background: isActive ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.01)",
                border: "1px solid",
                borderColor: isActive ? "var(--primary-glow-border)" : "transparent",
                transition: "all 0.3s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {/* Status dot */}
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  {isActive && pulsate && (
                    <span style={{
                      position: "absolute",
                      display: "inline-flex",
                      height: "12px",
                      width: "12px",
                      borderRadius: "50%",
                      backgroundColor: driver.color,
                      opacity: 0.4,
                      animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"
                    }}></span>
                  )}
                  <span style={{
                    position: "relative",
                    display: "inline-flex",
                    height: "8px",
                    width: "8px",
                    borderRadius: "50%",
                    backgroundColor: driver.color
                  }}></span>
                </div>

                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, color: isActive ? "var(--foreground)" : "var(--text-muted)" }}>
                    {driver.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
                    {driver.route}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--foreground)" }}>
                  {driver.eta}
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-light)" }}>
                  {driver.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Styled Animations via CSS injection */}
      <style jsx global>{`
        @keyframes ping {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          75%, 100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
