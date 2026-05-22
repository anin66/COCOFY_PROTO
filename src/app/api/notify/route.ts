import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Helper to parse stringified JSON service account keys with escaped quotes robustly
function parseServiceAccountKey(keyStr: string): any {
  let cleaned = keyStr.trim();
  
  // 1. If wrapped in outer quotes (e.g. from Vercel env UI), strip them or try parsing once as string
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

  // 1.5. Convert any raw newlines/carriage returns back into escaped \n and \r
  let jsonStr = cleaned.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  // 2. Unescape all escaped double quotes
  jsonStr = jsonStr.replace(/\\"/g, '"');

  // 3. Escape invalid backslashes (like \h or other non-JSON escape sequences)
  const cleanedJsonStr = jsonStr.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

  // 4. Parse JSON
  const parsed = JSON.parse(cleanedJsonStr);
  
  // 5. Replace literal \n in private_key with actual newlines
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
      console.log("Firebase Admin: Service Account Key successfully parsed.");
    } catch (e) {
      console.error("Firebase Admin Service Account Key Parsing Failed:", e);
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
    console.log("Firebase Admin SDK successfully initialized with service account.");
  } else {
    console.warn(
      "Firebase Admin SDK: No credentials found. Push notifications will run in MOCK mode."
    );
  }
}

export async function POST(request: Request) {
  try {
    const { recipientUids, recipientRoles, title, body, data } = await request.json();

    if (
      (!recipientUids || !Array.isArray(recipientUids) || recipientUids.length === 0) &&
      (!recipientRoles || !Array.isArray(recipientRoles) || recipientRoles.length === 0)
    ) {
      return NextResponse.json(
        { error: "Either recipientUids or recipientRoles is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!title || !body) {
      return NextResponse.json(
        { error: "title and body are required fields" },
        { status: 400 }
      );
    }

    // If running in mock mode, just log and return success
    if (admin.apps.length === 0) {
      const targetStr = `Uids [${(recipientUids || []).join(", ")}], Roles [${(recipientRoles || []).join(", ")}]`;
      console.log(`[MOCK NOTIFICATION] To ${targetStr}: ${title} - ${body}`);
      return NextResponse.json({
        success: true,
        message: "Notification logged in mock mode (credentials missing).",
        recipientCount: (recipientUids || []).length + (recipientRoles || []).length,
      });
    }

    const db = admin.firestore();
    const fcmTokens: string[] = [];
    const tokensToPrune: { [uid: string]: string[] } = {};

    // Gather all target UIDs
    const targetUids = new Set<string>(recipientUids || []);

    if (recipientRoles && Array.isArray(recipientRoles) && recipientRoles.length > 0) {
      for (const role of recipientRoles) {
        if (typeof role !== "string") continue;
        const lowercaseRole = role.toLowerCase();
        
        // Query users by role
        const roleSnap = await db.collection("users").where("role", "==", lowercaseRole).get();
        roleSnap.forEach((doc) => {
          targetUids.add(doc.id);
        });

        // Also query uppercase just in case
        const uppercaseRole = role.toUpperCase();
        if (uppercaseRole !== lowercaseRole) {
          const roleSnapUpper = await db.collection("users").where("role", "==", uppercaseRole).get();
          roleSnapUpper.forEach((doc) => {
            targetUids.add(doc.id);
          });
        }
      }
    }

    // 1. Fetch tokens for all recipients
    for (const uid of targetUids) {
      const userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData && userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
          const userTokens = userData.fcmTokens.filter(t => typeof t === "string" && t.trim() !== "");
          if (userTokens.length > 0) {
            fcmTokens.push(...userTokens);
            tokensToPrune[uid] = userTokens;
          }
        }
      }
    }

    const uniqueTokens = Array.from(new Set(fcmTokens));

    if (uniqueTokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No registered device tokens found for the recipients.",
        sentCount: 0,
      });
    }

    // 2. Prepare FCM payload
    // Standard payload: notification for OS/system trays, data for payloads
    const message = {
      notification: {
        title,
        body,
      },
      data: data ? Object.keys(data).reduce((acc: any, key) => {
        // FCM data values must be strings
        acc[key] = String(data[key]);
        return acc;
      }, {}) : {},
      android: {
        priority: "high" as const,
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
      },
      webpush: {
        headers: {
          Urgency: "high", // Request immediate delivery from push service (high urgency)
          TTL: "43200",    // Time to Live: 12 hours (in seconds)
        },
        notification: {
          title,
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          vibrate: [200, 100, 200], // Vibration pattern
          requireInteraction: false,
        },
        fcmOptions: {
          link: "/dashboard", // Click action URL (standard for Web FCM v1 API)
        }
      },
      tokens: uniqueTokens,
    };

    // 3. Send via Multicast
    const response = await admin.messaging().sendEachForMulticast(message);

    // 4. Prune expired or invalid tokens
    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        const token = uniqueTokens[idx];
        if (
          error &&
          (error.code === "messaging/registration-token-not-registered" ||
            error.code === "messaging/invalid-registration-token")
        ) {
          failedTokens.push(token);
        }
      }
    });

    if (failedTokens.length > 0) {
      console.log(`Pruning ${failedTokens.length} invalid/expired FCM tokens.`);
      for (const uid of Object.keys(tokensToPrune)) {
        const userTokens = tokensToPrune[uid];
        const invalidUserTokens = userTokens.filter((t) => failedTokens.includes(t));
        if (invalidUserTokens.length > 0) {
          await db
            .collection("users")
            .doc(uid)
            .update({
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidUserTokens),
            });
        }
      }
    }

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalCount: uniqueTokens.length,
    });
  } catch (err: any) {
    console.error("Failed to send push notification:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
