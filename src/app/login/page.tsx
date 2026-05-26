"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Lock, User, Phone, Calendar, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

type Role = "worker" | "delivery" | "manager" | "finance";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);

  const [role, setRole] = useState<Role>("worker");
  
  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            router.push(`/dashboard/${userData.role}`);
          }
        } catch (err) {
          console.error("Error during auto-login redirect:", err);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsub();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Safety check: Ensure environment variables are actually loaded
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      setError("CRITICAL ERROR: Firebase keys not found! Please go to your terminal, press Ctrl+C, and run 'npm run dev' again to restart the server.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // Handle Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Fetch role from Firestore to redirect correctly
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          localStorage.setItem("user_logged_in", "true");
          localStorage.setItem("user_role", userData.role);
          router.push(`/dashboard/${userData.role}`);
        } else {
          // Fallback
          localStorage.setItem("user_logged_in", "true");
          localStorage.setItem("user_role", "worker");
          router.push("/dashboard/worker");
        }
      } else {
        // Handle Signup
        if (needsSecurityCode && securityCode !== process.env.NEXT_PUBLIC_MANAGER_SECURITY_CODE) {
          throw new Error("Invalid Manager Security Code.");
        }

        console.log("Creating user account with Firebase Auth...");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("User account created successfully! UID:", user.uid);

        // Save extra data to Firestore
        console.log("Saving user profile data to Firestore database...");
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name,
          email,
          phone,
          dob,
          role,
          createdAt: new Date().toISOString()
        });
        console.log("User profile saved to Firestore! Redirecting...");

        localStorage.setItem("user_logged_in", "true");
        localStorage.setItem("user_role", role);
        router.push(`/dashboard/${role}`);
      }
    } catch (err: any) {
      console.error("Auth error details:", err);
      
      // Map Firebase error codes to user-friendly messages
      let friendlyMessage = "An error occurred during authentication.";
      
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        friendlyMessage = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "An account with this email already exists.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Password should be at least 6 characters.";
      } else if (err.message) {
        // Fallback to the error message, but clean it up if it has Firebase prefix
        friendlyMessage = err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim();
      }

      setError(friendlyMessage);
    } finally {
      console.log("Auth process finished.");
      setLoading(false);
    }
  };

  const needsSecurityCode = role === "manager" || role === "finance";

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Nav */}
      <nav style={{ padding: "2rem" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "var(--accent)" }}>
          <ArrowLeft size={20} /> Back to Home
        </Link>
      </nav>

      {/* Main Content */}
      <section style={{ 
        flex: 1, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        padding: "2rem"
      }}>
        <div className="glass-panel animate-fade-in" style={{ width: "100%", maxWidth: "500px" }}>
          
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h2 style={{ marginBottom: "0.5rem" }}>
              {isLogin ? "Welcome Back" : "Create an Account"}
            </h2>
            <p>{isLogin ? "Sign in to access your dashboard" : "Join COCOFY logistics platform"}</p>
          </div>

          {error && (
            <div style={{ 
              background: "rgba(239, 35, 60, 0.1)", 
              border: "1px solid var(--error)", 
              color: "var(--error)", 
              padding: "0.75rem", 
              borderRadius: "8px", 
              marginBottom: "1.5rem",
              fontSize: "0.875rem"
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleAuth}>
            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Select Your Role</label>
                <div className="login-role-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {(["worker", "delivery", "manager", "finance"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "8px",
                        border: `1px solid ${role === r ? "var(--primary)" : "var(--surface-border)"}`,
                        background: role === r ? "var(--primary-glow)" : "var(--surface-2)",
                        color: "var(--foreground)",
                        cursor: "pointer",
                        textTransform: "capitalize",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {r.replace("finance", "Finance Manager").replace("delivery", "Delivery Boy")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isLogin && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div style={{ position: "relative" }}>
                    <User size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
                    <input type="text" className="form-input" style={{ width: "100%", paddingLeft: "3rem" }} placeholder="John Doe" required value={name} onChange={e => setName(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
                    <input type="tel" className="form-input" style={{ width: "100%", paddingLeft: "3rem" }} placeholder="+1 234 567 8900" required value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <div style={{ position: "relative" }}>
                    <Calendar size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
                    <input type="date" className="form-input" style={{ width: "100%", paddingLeft: "3rem" }} required value={dob} onChange={e => setDob(e.target.value)} />
                  </div>
                </div>
                
                {needsSecurityCode && (
                  <div className="form-group animate-fade-in">
                    <label className="form-label">Manager Security Code</label>
                    <div style={{ position: "relative" }}>
                      <KeyRound size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--accent)" }} />
                      <input type="password" className="form-input" style={{ width: "100%", paddingLeft: "3rem", borderColor: "var(--accent)" }} placeholder="Enter authorization code" required value={securityCode} onChange={e => setSecurityCode(e.target.value)} />
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "0.25rem" }}>Required to register as a Manager or Finance Manager.</p>
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: "relative" }}>
                <Mail size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
                <input type="email" className="form-input" style={{ width: "100%", paddingLeft: "3rem" }} placeholder="hello@cocofy.com" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
                <input type="password" className="form-input" style={{ width: "100%", paddingLeft: "3rem" }} placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: "1rem" }} disabled={loading}>
              {loading ? (
                <div className="spinner" style={{ width: "20px", height: "20px", borderWidth: "2px" }} />
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
            <p style={{ fontSize: "0.875rem" }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "var(--accent)", 
                  fontWeight: 600, 
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                {isLogin ? "Sign Up" : "Log In"}
              </button>
            </p>
          </div>

        </div>
      </section>
    </main>
  );
}
