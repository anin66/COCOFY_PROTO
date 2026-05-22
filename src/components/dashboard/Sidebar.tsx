"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Trophy, 
  Tags, 
  History, 
  ClipboardList,
  IndianRupee,
  Truck,
  TrendingUp,
  LogOut,
  X
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, updateDoc, arrayRemove } from "firebase/firestore";
import { getMessaging, isSupported, getToken } from "firebase/messaging";

interface SidebarProps {
  userName?: string;
  userRole?: string;
}

export default function Sidebar({ userName = "Trial Manager", userRole = "MANAGER" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleClose = () => setIsOpen(false);

    window.addEventListener("toggle-sidebar", handleToggle);
    window.addEventListener("close-sidebar", handleClose);

    return () => {
      window.removeEventListener("toggle-sidebar", handleToggle);
      window.removeEventListener("close-sidebar", handleClose);
    };
  }, []);

  // Automatically close drawer when pathname changes (user navigated)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const managerNav = [
    { label: "Overview", icon: LayoutDashboard, href: "/dashboard/manager" },
    { label: "Scheduling", icon: CalendarDays, href: "/dashboard/manager/scheduling" },
    { label: "Workers List", icon: Users, href: "/dashboard/manager/workers" },
    { label: "Workers Ranking", icon: Trophy, href: "/dashboard/manager/ranking" },
    { label: "Job History", icon: History, href: "/dashboard/manager/history" },
    { label: "Plans", icon: ClipboardList, href: "/dashboard/manager/plans" },
  ];

  const workerNav = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard/worker" },
    { label: "Salary", icon: IndianRupee, href: "/dashboard/worker/salary" },
    { label: "Leaderboard", icon: Trophy, href: "/dashboard/worker/leaderboard" },
  ];

  const deliveryNav = [
    { label: "Deliveries", icon: Truck, href: "/dashboard/delivery" },
  ];

  const financeNav = [
    { label: "Overview", icon: LayoutDashboard, href: "/dashboard/finance" },
    { label: "Analytics", icon: TrendingUp, href: "/dashboard/finance/analytics" },
    { label: "Due Amount", icon: Tags, href: "/dashboard/finance/due" },
    { label: "Worker Salary", icon: IndianRupee, href: "/dashboard/finance/salary" },
    { label: "Payment History", icon: History, href: "/dashboard/finance/history" },
  ];

  let navItems = managerNav;
  if (userRole.toUpperCase().includes("WORKER")) navItems = workerNav;
  if (userRole.toUpperCase().includes("DELIVERY")) navItems = deliveryNav;
  if (userRole.toUpperCase().includes("FINANCE")) navItems = financeNav;

  const handleSignOut = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // 1. Remove the current FCM token from Firestore if supported
        try {
          const supported = await isSupported();
          if (supported) {
            const messagingInstance = getMessaging();
            const token = await getToken(messagingInstance, {
              vapidKey: "BDIFGhWoFRXZnc1xNjwd_Tb3A7lYu2kLv4XVRCE5KptT0xXMiglgWtg2-iJk4OgeT9_9qa5sD-EFyw3bCF5ptIw"
            });
            if (token) {
              const unregisterRes = await fetch("/api/register-token", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: currentUser.uid,
                  token,
                  unregister: true,
                }),
              });
              if (unregisterRes.ok) {
                console.log("FCM token unregistered from user document on sign out via API.");
              } else {
                console.warn("Failed to unregister FCM token via API status:", unregisterRes.status);
              }
            }
          }
        } catch (fcmErr) {
          console.warn("Could not unregister FCM token during sign out:", fcmErr);
        }

        // 2. Clear local storage cache keys
        localStorage.removeItem("fcm_registered_uid");
        localStorage.removeItem("fcm_registered_token_preview");
      }

      // 3. Perform Firebase sign out
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <>
      {/* Drawer Backdrop Overlay */}
      {isOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            animation: "fadeIn 0.2s ease-out"
          }}
        />
      )}

      <aside 
        className={`dashboard-sidebar ${isOpen ? "open" : ""}`}
        style={{
          width: "280px",
          height: "100vh",
          background: "var(--surface)",
          borderRight: "1px solid var(--surface-border)",
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem",
          position: "sticky",
          top: 0
        }}
      >
        {/* Logo & Close Button */}
        <div style={{ marginBottom: "3rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: "32px",
              height: "32px",
              background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "1.2rem",
              color: "white"
            }}>
              C
            </div>
            <h1 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Cocofy
            </h1>
          </div>
          <button 
            className="sidebar-close-btn"
            onClick={() => setIsOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "var(--foreground)",
              cursor: "pointer",
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "8px"
            }}
          >
            <X size={20} />
          </button>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          @media (max-width: 768px) {
            .sidebar-close-btn {
              display: flex !important;
            }
          }
        `}} />

      {/* Navigation */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.875rem 1rem",
                borderRadius: "12px",
                background: isActive ? "rgba(123, 44, 191, 0.15)" : "transparent",
                color: isActive ? "var(--primary)" : "var(--foreground)",
                fontWeight: isActive ? 600 : 500,
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                border: `1px solid ${isActive ? "rgba(123, 44, 191, 0.3)" : "transparent"}`,
                opacity: isActive ? 1 : 0.7,
                transform: "translateX(0)"
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--primary)";
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.transform = "translateX(4px)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--foreground)";
                  e.currentTarget.style.opacity = "0.7";
                  e.currentTarget.style.transform = "translateX(0)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Sign Out */}
      <div style={{ marginTop: "auto", borderTop: "1px solid var(--surface-border)", paddingTop: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}>
            <UserIcon size={24} color="rgba(255,255,255,0.5)" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{userName}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--accent)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {userRole}
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleSignOut}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            width: "100%",
            padding: "0.75rem",
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            transition: "color 0.2s ease",
            textAlign: "left",
            fontSize: "0.9rem"
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--error)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
    </>
  );
}

// Simple placeholder for user icon until an image is loaded
function UserIcon({ size, color }: { size: number, color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
}
