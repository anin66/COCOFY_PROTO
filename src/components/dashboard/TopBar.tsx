"use client";

import { Bell, Sun, Moon, Menu, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useNotificationRegister } from "@/hooks/useNotificationRegister";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const [isActive, setIsActive] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [userId, setUserId] = useState<string | undefined>();
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugState, setDebugState] = useState<any>(null);

  // Register push notifications
  useNotificationRegister(userId);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(undefined);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDebugState((window as any).__notificationDebug || null);
      
      const handleUpdate = () => {
        setDebugState((window as any).__notificationDebug || null);
      };
      window.addEventListener("notification-debug-update", handleUpdate);
      return () => window.removeEventListener("notification-debug-update", handleUpdate);
    }
  }, []);

  useEffect(() => {
    // Read current theme on mount
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const currentTheme = savedTheme || (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "dark";
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  return (
    <header 
      className="dashboard-topbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1.5rem 2rem",
        background: "var(--surface-overlay)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--surface-border)",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {/* Mobile Menu Toggle */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
          style={{
            background: "none",
            border: "none",
            color: "var(--foreground)",
            cursor: "pointer",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            padding: 0
          }}
        >
          <Menu size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: "var(--foreground)" }}>{title}</h2>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .mobile-menu-toggle {
            display: flex !important;
          }
        }
      `}} />

      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        
        {/* Active Toggle Status */}
        <button 
          onClick={() => setIsActive(!isActive)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: isActive ? "rgba(46, 204, 113, 0.1)" : "rgba(239, 35, 60, 0.1)",
            border: `1px solid ${isActive ? "rgba(46, 204, 113, 0.3)" : "rgba(239, 35, 60, 0.3)"}`,
            color: isActive ? "#2ecc71" : "var(--error)",
            padding: "0.5rem 1rem",
            borderRadius: "20px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: isActive ? "#2ecc71" : "var(--error)",
            boxShadow: isActive ? "0 0 8px #2ecc71" : "none"
          }} />
          {isActive ? "Active" : "Offline"}
        </button>

        {/* Push Status Diagnostics Button */}
        <button 
          onClick={() => setShowDebugModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            background: debugState?.swState === "registered-successfully" ? "rgba(46, 204, 113, 0.1)" : "rgba(243, 156, 18, 0.1)",
            border: `1px solid ${debugState?.swState === "registered-successfully" ? "rgba(46, 204, 113, 0.3)" : "rgba(243, 156, 18, 0.3)"}`,
            color: debugState?.swState === "registered-successfully" ? "#2ecc71" : "#f39c12",
            padding: "0.4rem 0.8rem",
            borderRadius: "20px",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          {debugState?.swState === "registered-successfully" ? (
            <>
              <ShieldCheck size={14} />
              <span>Push Active</span>
            </>
          ) : (
            <>
              <ShieldAlert size={14} />
              <span>Push Status</span>
            </>
          )}
        </button>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun size={20} color="var(--accent)" />
          ) : (
            <Moon size={20} color="var(--primary)" />
          )}
        </button>

        {/* Notifications */}
        <button style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          transition: "background 0.2s ease"
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
        >
          <Bell size={20} />
          {/* Notification Dot */}
          <div style={{
            position: "absolute",
            top: "8px",
            right: "10px",
            width: "8px",
            height: "8px",
            background: "var(--error)",
            borderRadius: "50%",
            border: "2px solid var(--background)"
          }} />
        </button>

      </div>

      {/* Diagnostics Modal */}
      {showDebugModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem",
        }}>
          <div style={{
            width: "100%",
            maxWidth: "450px",
            background: "var(--surface)",
            border: "1px solid var(--surface-border)",
            borderRadius: "16px",
            padding: "1.5rem",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            color: "var(--foreground)"
          }}>
            <h3 style={{ margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.2rem", fontWeight: 700 }}>
              <ShieldAlert color="var(--accent)" style={{ flexShrink: 0 }} />
              Push Notifications Diagnostics
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--surface-border)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-light)" }}>Browser Support:</span>
                <span style={{ fontWeight: 600, color: debugState?.browserSupported ? "#2ecc71" : "var(--error)" }}>
                  {debugState?.browserSupported ? "Supported" : "Unsupported"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--surface-border)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-light)" }}>Notification Permission:</span>
                <span style={{ fontWeight: 600, color: debugState?.permission === "granted" ? "#2ecc71" : "var(--error)" }}>
                  {debugState?.permission || "unknown"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--surface-border)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-light)" }}>Service Worker Step:</span>
                <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                  {debugState?.swState || "Not started"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", borderBottom: "1px solid var(--surface-border)", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-light)" }}>FCM Push Token Status:</span>
                <span style={{ fontSize: "0.75rem", fontFamily: "monospace", wordBreak: "break-all", background: "var(--surface-2)", padding: "0.4rem 0.5rem", borderRadius: "8px", marginTop: "0.25rem", border: "1px solid var(--surface-border)" }}>
                  {debugState?.fcmToken || "No token registered"}
                </span>
              </div>
              {debugState?.error && (
                <div style={{
                  background: "rgba(239, 35, 60, 0.1)",
                  border: "1px solid var(--error)",
                  color: "var(--error)",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  marginTop: "0.5rem",
                  wordBreak: "break-all"
                }}>
                  <strong>Last Error:</strong> {debugState.error}
                </div>
              )}
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <button 
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.reload();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "0.6rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--primary)",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                Reload & Retry
              </button>
              <button 
                onClick={() => setShowDebugModal(false)}
                style={{
                  flex: 1,
                  padding: "0.6rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: "1px solid var(--surface-border)",
                  background: "var(--surface-2)",
                  color: "var(--foreground)",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
