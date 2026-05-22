import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
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
    const { recipientUids, title, body, data } = await request.json();

    if (!recipientUids || !Array.isArray(recipientUids) || recipientUids.length === 0) {
      return NextResponse.json(
        { error: "recipientUids is required and must be a non-empty array" },
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
      console.log(`[MOCK NOTIFICATION] To UIDs [${recipientUids.join(", ")}]: ${title} - ${body}`);
      return NextResponse.json({
        success: true,
        message: "Notification logged in mock mode (credentials missing).",
        recipientCount: recipientUids.length,
      });
    }

    const db = admin.firestore();
    const fcmTokens: string[] = [];
    const tokensToPrune: { [uid: string]: string[] } = {};

    // 1. Fetch tokens for all recipients
    for (const uid of recipientUids) {
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
