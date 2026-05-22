import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Helper to parse stringified JSON service account keys with escaped quotes robustly
function parseServiceAccountKey(keyStr: string): any {
  let cleaned = keyStr.trim();
  
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    try {
      const parsedOnce = JSON.parse(cleaned);
      if (typeof parsedOnce === "object") return parsedOnce;
      if (typeof parsedOnce === "string") {
        cleaned = parsedOnce.trim();
      }
    } catch (e) {
      cleaned = cleaned.substring(1, cleaned.length - 1).trim();
    }
  } else if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }

  let jsonStr = cleaned.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  jsonStr = jsonStr.replace(/\\"/g, '"');
  const cleanedJsonStr = jsonStr.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
  const parsed = JSON.parse(cleanedJsonStr);
  
  if (parsed && typeof parsed === "object" && typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  
  return parsed;
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsedKey = parseServiceAccountKey(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = admin.credential.cert(parsedKey);
      console.log("Firebase Admin: Service Account Key successfully parsed in register-token.");
    } catch (e) {
      console.error("Firebase Admin Service Account Key Parsing Failed in register-token:", e);
    }
  }

  if (!credential && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || "cocofy-f3cab",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    });
  }

  if (credential) {
    admin.initializeApp({
      credential,
    });
    console.log("Firebase Admin SDK successfully initialized in register-token.");
  } else {
    console.warn(
      "Firebase Admin SDK: No credentials found in register-token. Push tokens will run in MOCK mode."
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId, token, unregister } = await request.json();

    if (!userId || !token) {
      return NextResponse.json(
        { error: "userId and token are required" },
        { status: 400 }
      );
    }

    if (admin.apps.length === 0) {
      console.log(`[MOCK REGISTER] User: ${userId}, Token: ${token}, Unregister: ${unregister}`);
      return NextResponse.json({ success: true, mock: true });
    }

    const db = admin.firestore();

    if (unregister) {
      // 1. Remove the token from the user
      await db.collection("users").doc(userId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
      });
      console.log(`Unregistered FCM token for user ${userId}`);
      return NextResponse.json({ success: true, unregistered: true });
    }

    // 2. Query other users who have this token and prune it
    const querySnap = await db.collection("users")
      .where("fcmTokens", "array-contains", token)
      .get();

    for (const doc of querySnap.docs) {
      if (doc.id !== userId) {
        await doc.ref.update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
        });
        console.log(`Pruned duplicate token from user ${doc.id} (now logging in as ${userId})`);
      }
    }

    // 3. Register the token for the current user
    await db.collection("users").doc(userId).update({
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token)
    });
    console.log(`Registered FCM token for user ${userId}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to register/unregister token:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
