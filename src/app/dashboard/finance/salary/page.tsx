"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function FinanceSalary() {
  const router = useRouter();
  const [currentUserRole, setCurrentUserRole] = useState<string>("finance");
  const [currentUserName, setCurrentUserName] = useState<string>("Finance Manager");

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
        }
      }
    });
    return () => unsubAuth();
  }, [router]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      <Sidebar userName={currentUserName} userRole={currentUserRole.toUpperCase()} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar title="Worker Salary" />

        <div style={{ padding: "2.5rem", flex: 1, maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
          <div className="flex-stack-mobile" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
            <div>
              <h2 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Worker Salary Management</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", margin: 0 }}>
                Manage payouts and worker earnings.
              </p>
            </div>
          </div>
          
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "300px",
            background: "rgba(13, 6, 40, 0.5)",
            backdropFilter: "blur(12px)",
            borderRadius: "12px",
            border: "1px dashed var(--surface-border)",
            color: "rgba(255,255,255,0.5)"
          }}>
            <p>Worker Salary Management Coming Soon</p>
          </div>
        </div>
      </main>
    </div>
  );
}
