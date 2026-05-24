"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Volume2, 
  VolumeX, 
  Grid, 
  List, 
  Terminal, 
  Cpu, 
  ShieldCheck, 
  MapPin, 
  Monitor, 
  Zap 
} from "lucide-react";

interface ServiceItem {
  id: string;
  num: string;
  title: string;
  tag: string;
  desc: string;
  tech: string;
  coords: string;
}

const SERVICES: ServiceItem[] = [
  {
    id: "dispatch",
    num: "01",
    title: "AUTONOMOUS DISPATCH",
    tag: "FLEET & RUNS",
    desc: "Automated route planning and dispatch algorithms. Optimizes schedules, monitors active drivers in real-time, and auto-assigns loads based on driver capacity and tier milestones.",
    tech: "ALGO: DIJKSTRA // DURATION: 1.4s",
    coords: "LAT 12.973 // LON 77.594"
  },
  {
    id: "harvest",
    num: "02",
    title: "PRECISION HARVEST",
    tag: "FIELD OPERATIONS",
    desc: "Real-time crop logging and worker performance telemetry. Monitors field worker yields, verifies locations via geofences, and calculates tier bonuses with transparent auditing.",
    tech: "GPS: ACTIVE // PRECISION: 2.1m",
    coords: "LAT 12.295 // LON 76.639"
  },
  {
    id: "ledgers",
    num: "03",
    title: "TRUSTED LEDGERS",
    tag: "FINANCE & COMPLIANCE",
    desc: "Transparent financial pipeline. Automatically calculates worker earnings, handles tax compliance, schedules instant payouts, and logs cash flows into an immutable system ledger.",
    tech: "SHA-256: SECURE // CONCURRENCY: HIGH",
    coords: "LAT 13.082 // LON 80.270"
  },
  {
    id: "routing",
    num: "04",
    title: "HYPERLOCAL ROUTING",
    tag: "FINAL-MILE COURIER",
    desc: "Turn-by-turn localized routing engine. Adapts to real-time traffic blockages, localized road restrictions, and cargo load balances to ensure final-mile dropoffs are executed with zero delays.",
    tech: "LATENCY: 8ms // ENGINE: COCO-ROUTE v3",
    coords: "LAT 18.922 // LON 72.834"
  }
];

export default function ActiveTheoryShowcase() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [sysTime, setSysTime] = useState<string>("");
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Update clock in header to look like a live server timestamp
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setSysTime(d.toUTCString().replace("GMT", "UTC"));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio API synthesiser for high-end sci-fi sound effects
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  const playBloop = (freq: number, duration: number, type: "sine" | "square" | "triangle" = "sine", vol: number = 0.05) => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gainNode.gain.setValueAtTime(vol, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log("Audio synthesis error:", e);
    }
  };

  // Hover triggers for list items
  const handleItemHover = (index: number) => {
    if (activeIdx !== index) {
      setActiveIdx(index);
      playBloop(680 + index * 60, 0.08, "sine", 0.04);
    }
  };

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (nextState) {
      // Short synthetic notification blip to verify sound is working
      setTimeout(() => {
        playBloop(440, 0.1, "sine", 0.06);
        setTimeout(() => playBloop(880, 0.15, "sine", 0.06), 100);
      }, 50);
    }
  };

  const handleLinkHover = () => {
    playBloop(1100, 0.05, "sine", 0.03);
  };

  const handleCardHover = () => {
    playBloop(220, 0.15, "triangle", 0.05);
  };

  // Custom Cursor state handling
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [cursorHovered, setCursorHovered] = useState(false);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    const handleHoverStart = () => setCursorHovered(true);
    const handleHoverEnd = () => setCursorHovered(false);

    window.addEventListener("mousemove", moveCursor);

    // Apply custom cursor interactions to interactive targets
    const attachListeners = () => {
      const targets = document.querySelectorAll("a, button, [role='button'], .giant-list-item, .cyber-card");
      targets.forEach((el) => {
        el.addEventListener("mouseenter", handleHoverStart);
        el.addEventListener("mouseleave", handleHoverEnd);
      });
    };

    // Delay attach slightly to allow elements to mount
    const timeout = setTimeout(attachListeners, 500);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      clearTimeout(timeout);
    };
  }, [viewMode]);

  return (
    <div className="full-scroll-container">
      {/* Custom Cursor Followers (hidden on touchscreens) */}
      <div 
        className={`custom-cursor ${cursorHovered ? "hovered" : ""}`}
        style={{
          left: `${cursorPos.x}px`,
          top: `${cursorPos.y}px`,
        }}
      />
      <div 
        className="custom-cursor-inner"
        style={{
          left: `${cursorPos.x}px`,
          top: `${cursorPos.y}px`,
        }}
      />

      {/* Futuristic HUD Header */}
      <header 
        style={{
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--surface-border)",
          backgroundColor: "rgba(6, 9, 6, 0.8)",
          backdropFilter: "blur(12px)",
          zIndex: 50,
          position: "sticky",
          top: 0
        }}
      >
        <div 
          onMouseEnter={handleLinkHover}
          style={{ 
            fontFamily: "monospace", 
            fontWeight: 800, 
            letterSpacing: "3px", 
            color: "var(--foreground)",
            fontSize: "1.1rem"
          }}
        >
          COCOFY <span style={{ color: "var(--accent)" }}>// LOGISTICS</span>
        </div>

        {/* Live system telemetries */}
        <div 
          className="hidden lg:flex"
          style={{
            fontFamily: "monospace",
            fontSize: "0.7rem",
            color: "var(--text-light)",
            gap: "2rem",
            letterSpacing: "1.5px"
          }}
        >
          <span>SYS.TIME // {sysTime || "FETCHING..."}</span>
          <span>NET.STATUS // 100% ONLINE</span>
          <span>LOCATION // SECURE COMMAND</span>
        </div>

        {/* HUD Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {/* Audio Synthesiser Toggle */}
          <button
            onClick={toggleSound}
            onMouseEnter={handleLinkHover}
            className="btn-secondary"
            style={{
              padding: "0.4rem 0.8rem",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              borderRadius: "4px",
              cursor: "none",
              border: "1px solid rgba(255,255,255,0.08)",
              background: soundEnabled ? "rgba(132,204,22,0.1)" : "rgba(0,0,0,0.2)"
            }}
          >
            {soundEnabled ? <Volume2 size={14} className="text-accent" /> : <VolumeX size={14} className="text-muted" />}
            <span style={{ color: soundEnabled ? "var(--accent)" : "var(--text-muted)" }}>
              SOUND: {soundEnabled ? "ON" : "OFF"}
            </span>

            {/* Micro sound waves */}
            <div className={`sound-toggle-waves ${soundEnabled ? "playing" : ""}`}>
              <div className="sound-wave-bar" />
              <div className="sound-wave-bar" />
              <div className="sound-wave-bar" />
              <div className="sound-wave-bar" />
            </div>
          </button>

          {/* List vs Grid Layout View Toggle */}
          <div className="view-toggle-container">
            <button
              onClick={() => {
                setViewMode("list");
                playBloop(520, 0.1, "sine", 0.05);
              }}
              onMouseEnter={handleLinkHover}
              className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
            >
              <List size={12} style={{ marginRight: "4px", display: "inline-block", verticalAlign: "middle" }} />
              LIST
            </button>
            <button
              onClick={() => {
                setViewMode("grid");
                playBloop(520, 0.1, "sine", 0.05);
              }}
              onMouseEnter={handleLinkHover}
              className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
            >
              <Grid size={12} style={{ marginRight: "4px", display: "inline-block", verticalAlign: "middle" }} />
              GRID
            </button>
          </div>
        </div>
      </header>

      {/* Main Interactive Showcase */}
      <section className="scroll-section" style={{ flex: 1 }}>
        <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", zIndex: 10 }}>
          
          {viewMode === "list" ? (
            /* LIST VIEW MODE */
            <div 
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "3rem",
                width: "100%"
              }}
            >
              {/* Telemetry Indicator Title */}
              <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-light)", letterSpacing: "2px", borderBottom: "1px dashed rgba(255,255,255,0.06)", paddingBottom: "1rem" }}>
                COCOFY CORE LOGISTICS SUITE // SELECT PILLAR TO VIEW CONSOLE TELEMETRY
              </div>

              <div 
                style={{ 
                  display: "flex", 
                  gap: "4rem", 
                  alignItems: "stretch",
                  flexDirection: "row" 
                }}
                className="flex-col lg:flex-row"
              >
                {/* Left Side: Services List */}
                <div style={{ flex: 1.2, display: "flex", flexDirection: "column" }}>
                  {SERVICES.map((item, idx) => (
                    <div
                      key={item.id}
                      onMouseEnter={() => handleItemHover(idx)}
                      className={`giant-list-item ${activeIdx === idx ? "active" : ""}`}
                    >
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span className="giant-list-num">{item.num} //</span>
                        <span>{item.title}</span>
                      </div>
                      <ArrowRight 
                        size={28} 
                        style={{ 
                          opacity: activeIdx === idx ? 1 : 0,
                          transform: activeIdx === idx ? "translateX(0)" : "translateX(-15px)",
                          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                          color: "var(--accent)"
                        }} 
                      />
                    </div>
                  ))}
                </div>

                {/* Right Side: Floating Telemetry HUD Preview Panel */}
                <div 
                  style={{ 
                    flex: 1, 
                    minHeight: "400px",
                    display: "flex",
                    flexDirection: "column"
                  }}
                  className="hidden lg:flex"
                >
                  <div className="hud-panel">
                    {/* Camera Brackets */}
                    <div className="hud-bracket bracket-tl" />
                    <div className="hud-bracket bracket-tr" />
                    <div className="hud-bracket bracket-bl" />
                    <div className="hud-bracket bracket-br" />
                    
                    {/* Crosshair */}
                    <div className="hud-crosshair" />

                    {/* HUD Header Bar */}
                    <div 
                      style={{
                        padding: "1rem 1.5rem",
                        borderBottom: "1px dashed rgba(46, 125, 50, 0.2)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: "monospace",
                        fontSize: "0.65rem",
                        color: "var(--accent)"
                      }}
                    >
                      <span>CONSOLE // PREVIEW_{SERVICES[activeIdx].num}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "6px", height: "6px", backgroundColor: "var(--accent)", borderRadius: "50%", display: "inline-block", animation: "pulse 1s infinite alternate" }} />
                        FEED: ACTIVE
                      </span>
                    </div>

                    {/* Interactive Animated Visual Screen */}
                    <div 
                      style={{ 
                        height: "220px", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        position: "relative",
                        overflow: "hidden"
                      }}
                    >
                      {/* Grid scanning bar */}
                      <div 
                        style={{
                          position: "absolute",
                          left: 0,
                          width: "100%",
                          height: "2px",
                          backgroundColor: "rgba(132, 204, 22, 0.15)",
                          boxShadow: "0 0 10px var(--accent)",
                          animation: "scanning-bar 4s linear infinite"
                        }}
                      />

                      {/* Displaying different animated mockups for each service */}
                      {activeIdx === 0 && (
                        /* Radar scan animation for Dispatch */
                        <div 
                          style={{
                            width: "120px",
                            height: "120px",
                            border: "1px solid rgba(46, 125, 50, 0.4)",
                            borderRadius: "50%",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <div style={{ width: "80px", height: "80px", border: "1px dashed rgba(46, 125, 50, 0.3)", borderRadius: "50%", position: "absolute" }} />
                          <div style={{ width: "40px", height: "40px", border: "1px solid rgba(46, 125, 50, 0.2)", borderRadius: "50%", position: "absolute" }} />
                          
                          {/* Pulsing radar target blips */}
                          <div style={{ position: "absolute", top: "25%", left: "30%", width: "6px", height: "6px", backgroundColor: "var(--accent)", borderRadius: "50%", boxShadow: "0 0 10px var(--accent)", animation: "blinker 1.5s infinite alternate" }} />
                          <div style={{ position: "absolute", bottom: "35%", right: "20%", width: "6px", height: "6px", backgroundColor: "var(--accent)", borderRadius: "50%", boxShadow: "0 0 10px var(--accent)", animation: "blinker 2s infinite alternate-reverse" }} />
                          
                          {/* Radar sweep vector line */}
                          <div 
                            style={{
                              position: "absolute",
                              width: "50%",
                              height: "1px",
                              backgroundColor: "var(--accent)",
                              transformOrigin: "left center",
                              left: "50%",
                              animation: "rotate-sweep 3s linear infinite"
                            }}
                          />
                        </div>
                      )}

                      {activeIdx === 1 && (
                        /* Pulse audio EQ waves for Field Operations */
                        <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "80px" }}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <div 
                              key={num}
                              style={{
                                width: "4px",
                                backgroundColor: "var(--accent)",
                                boxShadow: "0 0 8px var(--primary)",
                                borderRadius: "2px",
                                animation: `eq-bars 0.8s ease-in-out infinite alternate`,
                                animationDelay: `${num * 0.1}s`,
                                height: "20px"
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {activeIdx === 2 && (
                        /* Immutable terminal logs streaming for Ledgers */
                        <div 
                          style={{
                            width: "80%",
                            height: "120px",
                            backgroundColor: "rgba(0,0,0,0.4)",
                            border: "1px solid rgba(46, 125, 50, 0.3)",
                            borderRadius: "4px",
                            fontFamily: "monospace",
                            fontSize: "0.6rem",
                            color: "var(--text-light)",
                            padding: "0.75rem",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px"
                          }}
                        >
                          <div style={{ color: "var(--accent)", display: "flex", justifyContent: "space-between" }}>
                            <span>[SYSTEM_AUDIT_ON]</span>
                            <span>HASH: DE79...8F</span>
                          </div>
                          <div style={{ animation: "console-scroll 3s linear infinite", display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ opacity: 0.8 }}>&gt; ledg.computePayout(worker_id: 8821)</div>
                            <div style={{ color: "#84cc16", opacity: 0.9 }}>  - STATUS: OK // COMPLIANCE: 100%</div>
                            <div style={{ opacity: 0.6 }}>&gt; ledg.ledgerCommit() - HASH WRITTEN</div>
                            <div style={{ opacity: 0.8 }}>&gt; ledg.calcBonusTier(run_multiplier: 1.25)</div>
                            <div style={{ color: "#84cc16" }}>  - BONUS ADDED: $45.20</div>
                            <div style={{ opacity: 0.5 }}>&gt; ledg.flushTransactions()</div>
                          </div>
                        </div>
                      )}

                      {activeIdx === 3 && (
                        /* Pulsing hyperlocal node connections for Routing */
                        <div style={{ width: "160px", height: "160px", position: "relative" }}>
                          {/* Centered Node */}
                          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "10px", height: "10px", backgroundColor: "#fff", border: "2px solid var(--accent)", borderRadius: "50%", zIndex: 10 }} />
                          {/* Satellite Nodes */}
                          <div style={{ position: "absolute", top: "20%", left: "20%", width: "6px", height: "6px", backgroundColor: "var(--accent)", borderRadius: "50%" }}>
                            <div style={{ width: "100%", height: "100%", position: "absolute", border: "1px solid var(--accent)", borderRadius: "50%", transform: "scale(2.5)", animation: "node-ripple 1.5s infinite" }} />
                          </div>
                          <div style={{ position: "absolute", top: "15%", right: "30%", width: "6px", height: "6px", backgroundColor: "var(--accent)", borderRadius: "50%" }} />
                          <div style={{ position: "absolute", bottom: "25%", left: "15%", width: "6px", height: "6px", backgroundColor: "var(--accent)", borderRadius: "50%" }} />
                          <div style={{ position: "absolute", bottom: "20%", right: "25%", width: "6px", height: "6px", backgroundColor: "var(--accent)", borderRadius: "50%" }}>
                            <div style={{ width: "100%", height: "100%", position: "absolute", border: "1px solid var(--accent)", borderRadius: "50%", transform: "scale(2.5)", animation: "node-ripple 2s infinite" }} />
                          </div>

                          {/* CSS SVG Connecting Lines */}
                          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                            <line x1="80" y1="80" x2="32" y2="32" stroke="rgba(132, 204, 22, 0.4)" strokeWidth="1" strokeDasharray="4 2" />
                            <line x1="80" y1="80" x2="112" y2="24" stroke="rgba(132, 204, 22, 0.4)" strokeWidth="1" />
                            <line x1="80" y1="80" x2="24" y2="120" stroke="rgba(132, 204, 22, 0.4)" strokeWidth="1" />
                            <line x1="80" y1="80" x2="120" y2="128" stroke="rgba(132, 204, 22, 0.4)" strokeWidth="1" strokeDasharray="2 2" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* HUD Footer Telemetry info */}
                    <div 
                      style={{
                        padding: "1rem 1.5rem",
                        borderTop: "1px dashed rgba(46, 125, 50, 0.2)",
                        fontFamily: "monospace",
                        fontSize: "0.65rem",
                        color: "var(--text-light)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem"
                      }}
                    >
                      <div style={{ color: "var(--foreground)", fontSize: "0.8rem", fontWeight: "bold" }}>
                        {SERVICES[activeIdx].tag}
                      </div>
                      <p style={{ fontSize: "0.7rem", lineHeight: 1.5, color: "var(--text-muted)", margin: 0 }}>
                        {SERVICES[activeIdx].desc}
                      </p>
                      <div className="cyber-ticker">
                        <span>{SERVICES[activeIdx].tech}</span>
                        <span>{SERVICES[activeIdx].coords}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* GRID VIEW MODE */
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-light)", letterSpacing: "2px", borderBottom: "1px dashed rgba(255,255,255,0.06)", paddingBottom: "1rem" }}>
                COCOFY CORE LOGISTICS SUITE // COMPONENT MODULES GRID
              </div>
              
              <div className="cyber-card-grid">
                {SERVICES.map((item, idx) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => {
                      setActiveIdx(idx);
                      handleCardHover();
                    }}
                    className="cyber-card"
                  >
                    {/* Visual Hover Glow */}
                    <div className="cyber-card-glow" />

                    <div className="cyber-card-tag">{item.tag}</div>
                    <h3 style={{ fontSize: "1.25rem", color: "var(--foreground)", fontFamily: "var(--font-sans)", fontWeight: 800, marginBottom: "0.75rem" }}>
                      {item.num} // {item.title}
                    </h3>
                    <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text-muted)", marginBottom: "1rem" }}>
                      {item.desc}
                    </p>

                    <div className="cyber-ticker">
                      <span>{item.tech.split(" // ")[0]}</span>
                      <span>{item.coords.split(" // ")[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Get Started Grid (Onboarding Ports) - Appears at the bottom of the page */}
      <section 
        style={{
          borderTop: "1px solid var(--surface-border)",
          backgroundColor: "rgba(6, 9, 6, 0.6)",
          padding: "5rem 2rem",
          position: "relative",
          zIndex: 10
        }}
      >
        <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
          
          <div style={{ marginBottom: "3rem", textAlign: "center" }}>
            <div 
              style={{ 
                fontFamily: "monospace", 
                color: "var(--accent)", 
                fontSize: "0.8rem", 
                letterSpacing: "3px", 
                marginBottom: "0.75rem" 
              }}
            >
              AUTHENTICATION & ONBOARDING GATEWAY
            </div>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-1px" }}>
              Access Command Ports
            </h2>
            <p style={{ maxWidth: "550px", margin: "0 auto", fontSize: "0.95rem", color: "var(--text-muted)" }}>
              Select your specific operating sector below. Accessing console databases requires verified credentials.
            </p>
          </div>

          <div className="cyber-card-grid">
            {/* Card 1: Manager */}
            <Link 
              href="/login?role=manager" 
              onMouseEnter={handleCardHover}
              onClick={() => playBloop(880, 0.25, "triangle", 0.08)}
              className="cyber-card"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div className="cyber-card-glow" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(132, 204, 22, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", color: "var(--accent)", padding: "8px" }}>
                  <Monitor size={24} />
                </div>
                <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "var(--text-dim)" }}>PORT // 01</span>
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>MANAGER HUB</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", flex: 1 }}>
                Command console for dispatch scheduling, real-time routing metrics, and field team oversight.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--accent)", fontWeight: "bold" }}>
                AUTHENTICATE NOW <ArrowRight size={14} />
              </div>
            </Link>

            {/* Card 2: Worker */}
            <Link 
              href="/login?role=worker" 
              onMouseEnter={handleCardHover}
              onClick={() => playBloop(880, 0.25, "triangle", 0.08)}
              className="cyber-card"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div className="cyber-card-glow" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(132, 204, 22, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", color: "var(--accent)", padding: "8px" }}>
                  <Zap size={24} />
                </div>
                <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "var(--text-dim)" }}>PORT // 02</span>
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>WORKER PORTAL</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", flex: 1 }}>
                Log yields, check daily crop telemetry, calculate payout margins, and track harvest tier levels.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--accent)", fontWeight: "bold" }}>
                AUTHENTICATE NOW <ArrowRight size={14} />
              </div>
            </Link>

            {/* Card 3: Delivery */}
            <Link 
              href="/login?role=delivery" 
              onMouseEnter={handleCardHover}
              onClick={() => playBloop(880, 0.25, "triangle", 0.08)}
              className="cyber-card"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div className="cyber-card-glow" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(132, 204, 22, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", color: "var(--accent)", padding: "8px" }}>
                  <MapPin size={24} />
                </div>
                <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "var(--text-dim)" }}>PORT // 03</span>
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>FLEET AGENT</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", flex: 1 }}>
                Mobile dispatch console providing turn-by-turn hyperlocal routing overlays and dropoff verification.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--accent)", fontWeight: "bold" }}>
                AUTHENTICATE NOW <ArrowRight size={14} />
              </div>
            </Link>

            {/* Card 4: Finance */}
            <Link 
              href="/login?role=finance" 
              onMouseEnter={handleCardHover}
              onClick={() => playBloop(880, 0.25, "triangle", 0.08)}
              className="cyber-card"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div className="cyber-card-glow" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(132, 204, 22, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", color: "var(--accent)", padding: "8px" }}>
                  <ShieldCheck size={24} />
                </div>
                <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "var(--text-dim)" }}>PORT // 04</span>
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>AUDITOR HUB</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", flex: 1 }}>
                Inspect immutable system transaction ledgers, review P&L cashflows, and run payouts.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--accent)", fontWeight: "bold" }}>
                AUTHENTICATE NOW <ArrowRight size={14} />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Cyber Footer */}
      <footer 
        style={{
          padding: "2rem",
          textAlign: "center",
          borderTop: "1px dashed var(--surface-border)",
          fontFamily: "monospace",
          fontSize: "0.7rem",
          color: "var(--text-dim)",
          backgroundColor: "#060906",
          letterSpacing: "1.5px"
        }}
      >
        © {new Date().getFullYear()} COCOFY LOGISTICS CORE // ALL CHANNELS SECURE // ACCREDITED ISO-27001
      </footer>

      {/* Embedded scanning keyframe animation stylesheet helper */}
      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        @keyframes blinker {
          0% { opacity: 0.2; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes rotate-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes scanning-bar {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes eq-bars {
          0% { height: 10px; }
          100% { height: 80px; }
        }
        @keyframes console-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-30px); }
        }
        @keyframes node-ripple {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
