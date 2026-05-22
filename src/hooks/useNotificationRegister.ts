"use client";

import { useEffect } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getToken, isSupported, getMessaging } from "firebase/messaging";
import { app, db } from "@/lib/firebase";

const DEFAULT_VAPID_KEY = "BDIFGhWoFRXZnc1xNjwd_Tb3A7lYu2kLv4XVRCE5KptT0xXMiglgWtg2-iJk4OgeT9_9qa5sD-EFyw3bCF5ptIw";

export function useNotificationRegister(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined") return;

    const registerNotification = async () => {
      try {
        // 1. Verify browser support
        if (!("serviceWorker" in navigator) || !("Notification" in window)) {
          console.warn("This browser does not support push notifications.");
          return;
        }

        // 2. Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.log("Notification permission denied or dismissed.");
          return;
        }

        // 3. Wait for Firebase Messaging to be supported and initialized
        const supported = await isSupported();
        if (!supported) {
          console.log("Firebase Messaging not supported in this browser.");
          return;
        }
        const messagingInstance = getMessaging(app);

        // 4. Register the Service Worker (standard practice for Next.js app router messaging)
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("Firebase Messaging Service Worker registered successfully:", registration);

        // 5. Retrieve FCM token
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || DEFAULT_VAPID_KEY;
        const currentToken = await getToken(messagingInstance, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (currentToken) {
          console.log("FCM registration token acquired:", currentToken);

          // 6. Save token to Firestore under users/{userId}
          const userDocRef = doc(db, "users", userId);
          await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(currentToken)
          });
          console.log("FCM token successfully registered in Firestore users document.");
        } else {
          console.warn("No registration token available. Request permission to generate one.");
        }
      } catch (err) {
        console.error("An error occurred while registering push notification: ", err);
      }
    };

    // Delay registration slightly to allow initial page hydration to complete smoothly
    const timer = setTimeout(() => {
      registerNotification();
    }, 3000);

    return () => clearTimeout(timer);
  }, [userId]);
}
