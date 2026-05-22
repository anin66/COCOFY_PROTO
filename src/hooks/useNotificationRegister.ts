"use client";

import { useEffect } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getToken, isSupported, getMessaging } from "firebase/messaging";
import { app, db } from "@/lib/firebase";

const DEFAULT_VAPID_KEY = "BDIFGhWoFRXZnc1xNjwd_Tb3A7lYu2kLv4XVRCE5KptT0xXMiglgWtg2-iJk4OgeT9_9qa5sD-EFyw3bCF5ptIw";

const updateDebug = (info: any) => {
  if (typeof window !== "undefined") {
    (window as any).__notificationDebug = {
      ...((window as any).__notificationDebug || {
        browserSupported: false,
        permission: "unknown",
        swState: "not-started",
        fcmToken: "",
        error: ""
      }),
      ...info
    };
    window.dispatchEvent(new CustomEvent("notification-debug-update"));
  }
};

export function useNotificationRegister(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined") return;

    // Load initial state immediately from localStorage if already registered before
    if (Notification.permission === "granted") {
      const cachedUid = localStorage.getItem("fcm_registered_uid");
      const cachedTokenPreview = localStorage.getItem("fcm_registered_token_preview");
      if (cachedUid === userId) {
        updateDebug({
          browserSupported: true,
          permission: "granted",
          swState: "registered-successfully",
          fcmToken: cachedTokenPreview || "Registered (cached)",
          error: ""
        });
      }
    }

    const registerNotification = async () => {
      try {
        updateDebug({ browserSupported: true, permission: Notification.permission, swState: "checking-support", error: "" });

        // 1. Verify browser support
        if (!("serviceWorker" in navigator) || !("Notification" in window)) {
          console.warn("This browser does not support push notifications.");
          updateDebug({ browserSupported: false, error: "Service Workers or Notification API missing." });
          return;
        }

        // 2. Request permission
        updateDebug({ swState: "requesting-permission" });
        const permission = await Notification.requestPermission();
        updateDebug({ permission });
        if (permission !== "granted") {
          console.log("Notification permission denied or dismissed.");
          updateDebug({ error: `Permission is ${permission}`, swState: "permission-denied" });
          return;
        }

        // 3. Wait for Firebase Messaging to be supported and initialized
        updateDebug({ swState: "checking-firebase-support" });
        const supported = await isSupported();
        if (!supported) {
          console.log("Firebase Messaging not supported in this browser.");
          updateDebug({ error: "Firebase Messaging isSupported() returned false.", swState: "firebase-unsupported" });
          return;
        }
        const messagingInstance = getMessaging(app);

        // 4. Register the Service Worker (standard practice for Next.js app router messaging)
        updateDebug({ swState: "registering-sw" });
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("Firebase Messaging Service Worker registered successfully:", registration);

        updateDebug({ swState: "waiting-for-sw-ready" });
        await navigator.serviceWorker.ready;
        updateDebug({ swState: "sw-ready" });

        // 5. Retrieve FCM token
        updateDebug({ swState: "fetching-fcm-token" });
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || DEFAULT_VAPID_KEY;
        const currentToken = await getToken(messagingInstance, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (currentToken) {
          const tokenPreview = currentToken.substring(0, 12) + "..." + currentToken.substring(currentToken.length - 8);
          console.log("FCM registration token acquired:", currentToken);
          updateDebug({ fcmToken: tokenPreview, swState: "saving-to-firestore" });

          // 6. Save token to Firestore under users/{userId}
          const userDocRef = doc(db, "users", userId);
          await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(currentToken)
          });
          console.log("FCM token successfully registered in Firestore users document.");
          
          // Cache in localStorage to load instantly on refresh
          localStorage.setItem("fcm_registered_uid", userId);
          localStorage.setItem("fcm_registered_token_preview", tokenPreview);

          updateDebug({ swState: "registered-successfully" });
        } else {
          console.warn("No registration token available. Request permission to generate one.");
          updateDebug({ error: "No registration token returned from Firebase.", swState: "token-empty" });
        }
      } catch (err: any) {
        console.error("An error occurred while registering push notification: ", err);
        updateDebug({ error: err.message || String(err), swState: "error" });
      }
    };

    // Delay registration slightly to allow initial page hydration to complete smoothly
    const timer = setTimeout(() => {
      registerNotification();
    }, 3000);

    return () => clearTimeout(timer);
  }, [userId]);
}
