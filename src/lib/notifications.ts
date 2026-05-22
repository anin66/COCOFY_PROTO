import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * Triggers a push notification to one or more user IDs by sending a request to the server API.
 * 
 * @param recipientUids Array of Firestore User UIDs
 * @param title Notification Title
 * @param body Notification Body text
 * @param data Optional payload data
 */
export async function triggerPushNotification(
  recipientUids: string[],
  title: string,
  body: string,
  data?: Record<string, any>
) {
  if (!recipientUids || recipientUids.length === 0) return;

  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipientUids,
        title,
        body,
        data,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Failed to send notification via api:", result);
    } else {
      console.log("Push notifications dispatched successfully:", result);
    }
  } catch (err) {
    console.error("Error dispatching push notification request:", err);
  }
}

/**
 * Utility to fetch all User UIDs matching a specific role in Cocofy.
 * Useful for broadcasting notifications to all Managers or Finance Managers.
 * 
 * @param role "manager" | "finance" | "worker" | "delivery"
 */
export async function getUidsByRole(role: "manager" | "finance" | "worker" | "delivery"): Promise<string[]> {
  try {
    const q = query(collection(db, "users"), where("role", "==", role));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => doc.id);
  } catch (err) {
    console.error(`Failed to fetch UIDs for role ${role}:`, err);
    return [];
  }
}
