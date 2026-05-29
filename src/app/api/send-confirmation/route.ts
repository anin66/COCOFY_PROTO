import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Helper to parse stringified JSON service account keys robustly
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
    } catch (e) {
      console.error("Firebase Admin Service Account Key Parsing Failed in send-confirmation:", e);
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
  }
}

// Format raw phone string to Twilio WhatsApp scheme (e.g. +91XXXXXXXXXX -> whatsapp:+91XXXXXXXXXX)
function formatPhoneNumberForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.length >= 11) {
    return `whatsapp:+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `whatsapp:+91${cleaned}`;
  }
  return `whatsapp:+${cleaned}`;
}

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    if (admin.apps.length === 0) {
      return NextResponse.json(
        { error: "Firebase Admin SDK not initialized." },
        { status: 500 }
      );
    }

    const db = admin.firestore();
    const jobDocRef = db.collection("jobs").doc(jobId);
    const jobSnap = await jobDocRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const jobData = jobSnap.data() || {};
    const customerPhone = jobData.phone;
    const customerName = jobData.customerName || "Customer";
    const harvestDate = jobData.date || "scheduled date";
    const harvestTime = jobData.time || "scheduled time";

    if (!customerPhone) {
      return NextResponse.json({ error: "Job does not have a customer phone number." }, { status: 400 });
    }

    // 1. Generate secure token for public location picker link
    const locationToken =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    // Save the token to the job document
    await jobDocRef.update({ locationToken });

    // 2. Prepare WhatsApp payload
    const toPhone = formatPhoneNumberForWhatsApp(customerPhone);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const secureUrl = `${appUrl}/select-location/${jobId}?token=${locationToken}`;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

    const bodyText = `Your appointment is coming up on ${harvestDate} at ${harvestTime}.

Please choose your precise location by clicking the link below:
${secureUrl}

If you need to change it, please reply back and let us know.`;

    // 3. Send message via Twilio
    if (!accountSid || !authToken) {
      console.log(`[MOCK WHATSAPP] To: ${toPhone}, From: ${fromPhone}, Body: ${bodyText}`);
      return NextResponse.json({
        success: true,
        mock: true,
        message: "Twilio credentials missing. Running in Mock Mode.",
        token: locationToken,
        url: secureUrl
      });
    }

    const params = new URLSearchParams();
    params.append("To", toPhone);
    params.append("From", fromPhone);
    params.append("Body", bodyText);

    const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio API Error response:", twilioData);
      return NextResponse.json(
        { error: twilioData.message || "Failed to send WhatsApp message via Twilio." },
        { status: twilioRes.status }
      );
    }

    console.log(`WhatsApp confirmation successfully sent to ${toPhone}. SID: ${twilioData.sid}`);
    return NextResponse.json({
      success: true,
      messageSid: twilioData.sid,
      token: locationToken,
      url: secureUrl
    });
  } catch (err: any) {
    console.error("Error in send-confirmation API:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
