"use client";

import { Bell, Sun, Moon, Menu } from "lucide-react";
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
    </header>
  );
}
