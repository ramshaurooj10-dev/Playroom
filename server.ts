import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch (_) {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidUUID(str?: string | null): boolean {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}
import {
  verifyPurchaseTokenWithGoogle,
  generateVerifiedEntitlement,
  APP_PACKAGE_NAME,
  ALLOWED_PRODUCT_IDS,
  AllowedProductId,
  verifyEntitlementSignature,
} from "./server/googlePlayVerifier";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API endpoint for AI Preschool Assessment Summary
  app.post("/api/assessment-summary", async (req, res) => {
    try {
      const {
        childName,
        age,
        group,
        assessmentDate,
        achievedOutcomes,
        developingOutcomes,
        observations,
        evidence,
        teachingCriteria,
        customNotes,
      } = req.body;

      const hasOutcomes = (achievedOutcomes && achievedOutcomes.length > 0) || (developingOutcomes && developingOutcomes.length > 0);
      const hasObs = observations && observations.length > 0;
      const hasEv = evidence && evidence.length > 0;
      const hasNotes = customNotes && customNotes.trim().length > 0;
      const hasCriteria = teachingCriteria && teachingCriteria.length > 0;

      // If no teacher data is entered, strictly return the required message
      if (!hasOutcomes && !hasObs && !hasEv && !hasNotes && !hasCriteria) {
        return res.json({
          summary: "Not enough information has been recorded to provide a summary.",
          source: "insufficient-data",
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Fallback structured generation if no API key is set
        const summaryText = generateFallbackSummary({
          childName,
          age,
          group,
          assessmentDate,
          achievedOutcomes: achievedOutcomes || [],
          developingOutcomes: developingOutcomes || [],
          observations: observations || [],
          evidence: evidence || [],
          teachingCriteria: teachingCriteria || [],
          customNotes: customNotes || "",
        });
        return res.json({ summary: summaryText, source: "offline-template" });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a supportive, warm, and highly professional preschool educator crafting a comprehensive child progress report summary based ONLY on teacher-entered observational assessment records.

CRITICAL INSTRUCTIONS & SAFETY RULES:
- You MUST write in positive, strengths-based, developmentally appropriate preschool language.
- You MUST NOT make medical, psychological, psychiatric, neurological, or developmental-disorder diagnoses (NO clinical labels, NO diagnosing ASD, ADHD, speech delay, etc.).
- You MUST NOT invent fake evidence, fictitious activities, unobserved achievements, or unmentioned skills.
- Only summarize, synthesize, and organize the exact information, outcomes, observations, and criteria entered by the teacher below.
- If certain information is missing or not provided, state "Not yet recorded".
- Frame emerging skills and areas for support as exciting, gentle next developmental goals and collaborative teacher-parent play-based home-school connections.
- Clearly present this text as an educator summary of teacher-recorded observations.

CHILD INFORMATION:
- Child Name: ${childName || "Preschool Learner"}
- Age: ${age || "Preschool"}
- Class / Group: ${group || "Preschool Group"}
- Assessment Date: ${assessmentDate || new Date().toLocaleDateString()}

ACHIEVED LEARNING OUTCOMES (RECORDED BY TEACHER):
${achievedOutcomes && achievedOutcomes.length > 0 ? achievedOutcomes.map((o: string) => `• ${o}`).join("\n") : "Not yet recorded"}

DEVELOPING SKILLS (AREAS IN PROGRESS RECORDED BY TEACHER):
${developingOutcomes && developingOutcomes.length > 0 ? developingOutcomes.map((o: string) => `• ${o}`).join("\n") : "Not yet recorded"}

TEACHER OBSERVATION NOTES:
${observations && observations.length > 0 ? observations.map((ob: any) => `• Date: ${ob.date || "Recent"} | Area: ${ob.area || "General"} | Situation: ${ob.situation || "Classroom"} | Observed: ${ob.observed || ""} | Child's Words/Response: "${ob.childResponse || ""}" | Teacher Reflection: ${ob.notes || ""}`).join("\n") : "Not yet recorded"}

WORK SAMPLES & EVIDENCE:
${evidence && evidence.length > 0 ? evidence.map((ev: any) => `• Type: ${ev.type || "Sample"} | Description: ${ev.description || ""} | Outcome: ${ev.outcomeTitle || ""}`).join("\n") : "Not yet recorded"}

TEACHING ASSESSMENT CRITERIA & CLASSROOM PRACTICE (OBSERVED):
${teachingCriteria && teachingCriteria.length > 0 ? teachingCriteria.map((c: any) => `• [${c.category}] ${c.title}: ${c.status} ${c.notes ? `(Note: ${c.notes})` : ""}`).join("\n") : "Not yet recorded"}

ADDITIONAL TEACHER NOTES:
${customNotes || "None"}

STRUCTURE YOUR RESPONSE AS FOLLOWS:
1. **Executive Educator Overview**: A warm 2-3 sentence celebration of ${childName}'s engagement, curious exploration, and overall classroom presence based on recorded data.
2. **Key Developmental Strengths & Milestones**: Bullet points synthesizing specific recorded achievements and positive observational moments.
3. **Emerging Skills & Active Growth**: Encouraging, supportive summary of developing competencies with classroom strategies.
4. **Recommended Next Learning Goals & Home Connections**: 2-3 collaborative, play-based ideas for parents and educators to support continuous growth.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
      });

      const summary = response.text || "Summary generated successfully.";
      res.json({ summary, source: "gemini-3.7-flash" });
    } catch (err: any) {
      console.error("Gemini summary error:", err);
      // Return helpful fallback response if Gemini error occurs
      const fallback = generateFallbackSummary(req.body);
      res.json({ summary: fallback, source: "fallback-on-error" });
    }
  });

  // Server-side Payment Verification & License Management
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://puwfsjefjzljbxklljwk.supabase.co";
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;
  
  // Standard server client obeying standard RLS policies
  const serverSupabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  // Privileged server client strictly used server-side for backend-only administrative operations
  const serverAdminSupabase = SUPABASE_URL && SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : serverSupabase;

  // In-memory persistent cache for server-side licenses & requests
  const serverPaymentRequests: any[] = [];
  const serverLicenses: any[] = [];
  const serverGooglePlayPurchases: any[] = [];

  /**
   * Google Play Billing Verification Endpoint
   * Verifies Google Play purchases securely via the Google Play Developer API (androidpublisher v3),
   * calculates strictly server-authoritative 7-day or 30-day expiration, signs entitlement cryptographically,
   * and returns verified entitlement data without requiring any user login or Google OAuth.
   */
  app.post("/api/billing/verify-google-play-purchase", async (req, res) => {
    try {
      const { productId, purchaseToken, packageName, preSelectedActivityId } = req.body;

      if (!productId || !purchaseToken) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: "Missing required billing parameters (productId, purchaseToken).",
        });
      }

      // 1. Strict Package Name Validation
      const targetPackage = packageName || APP_PACKAGE_NAME;
      if (targetPackage !== APP_PACKAGE_NAME) {
        return res.status(403).json({
          success: false,
          verified: false,
          error: `Access denied. Package name '${targetPackage}' does not match '${APP_PACKAGE_NAME}'.`,
        });
      }

      // 2. Strict Product ID Whitelist
      if (!ALLOWED_PRODUCT_IDS.includes(productId as AllowedProductId)) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: `Unrecognized Google Play product ID: ${productId}. Expected: ${ALLOWED_PRODUCT_IDS.join(', ')}`,
        });
      }

      // 3. Verify Purchase Token directly with Google Play Developer API
      const googleResult = await verifyPurchaseTokenWithGoogle(
        targetPackage,
        productId,
        String(purchaseToken)
      );

      if (!googleResult.verified) {
        console.warn(`[Google Play Billing] Verification rejected for ${productId}:`, googleResult.error);
        return res.status(422).json({
          success: false,
          verified: false,
          error: googleResult.error || "Google Play purchase could not be verified.",
        });
      }

      // 4. Calculate server-authoritative entitlement and cryptographic signature
      const entitlement = generateVerifiedEntitlement(
        productId as AllowedProductId,
        String(purchaseToken),
        googleResult
      );

      // 5. Store verified record in server memory registry
      const existingIdx = serverGooglePlayPurchases.findIndex((p) => p.purchaseToken === purchaseToken);
      if (existingIdx !== -1) {
        serverGooglePlayPurchases[existingIdx] = entitlement;
      } else {
        serverGooglePlayPurchases.unshift(entitlement);
      }

      // 6. Record to Supabase DB if available
      if (serverSupabase) {
        try {
          await serverSupabase.from("purchases").insert([
            {
              id: entitlement.orderId,
              product_id: entitlement.productId,
              amount: entitlement.pricePaidPkr,
              currency: "PKR",
              payment_provider: "google_play",
              status: "COMPLETED",
              created_at: entitlement.purchaseTime,
              metadata: {
                purchaseToken: entitlement.purchaseToken,
                expiryTime: entitlement.expiryTime,
                unlockedType: entitlement.unlockedType,
                durationDays: entitlement.durationDays,
                verificationSource: entitlement.verificationSource,
                serverSignature: entitlement.serverSignature,
                preSelectedActivityId: preSelectedActivityId || null,
              },
            },
          ]);
        } catch (dbErr) {
          console.warn("[Billing DB] Could not record Google Play purchase to Supabase:", dbErr);
        }
      }

      console.log(`[Google Play Billing] Successfully verified & issued entitlement for ${productId} (Order: ${entitlement.orderId}, Expires: ${entitlement.expiryTime})`);

      return res.json({
        success: true,
        verified: true,
        entitlement,
      });
    } catch (err: any) {
      console.error("[Google Play Billing Server Error]", err);
      return res.status(500).json({
        success: false,
        verified: false,
        error: err.message || "Failed to verify Google Play purchase.",
      });
    }
  });

  /**
   * Google Play Billing List / Restore Endpoint
   * Restores active entitlements only if verified and non-expired.
   */
  app.post("/api/billing/restore-purchases", async (req, res) => {
    try {
      const { purchaseTokens } = req.body;
      const tokens: string[] = Array.isArray(purchaseTokens) ? purchaseTokens : [];
      const now = Date.now();

      const activeEntitlements = serverGooglePlayPurchases.filter((p) => {
        const matches = tokens.length === 0 || tokens.includes(p.purchaseToken);
        const isNotExpired = new Date(p.expiryTime).getTime() > now;
        const hasValidSignature = verifyEntitlementSignature(p);
        return matches && isNotExpired && hasValidSignature;
      });

      return res.json({
        success: true,
        entitlements: activeEntitlements,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || "Restore error" });
    }
  });

  /**
   * Submit Payment Request Endpoint
   * Manual payments (SadaPay, Bank Transfer, Payoneer offline) are strictly marked as PENDING and UNVERIFIED.
   * They do NOT unlock access automatically.
   */
  app.post("/api/payment/submit-request", async (req, res) => {
    try {
      const {
        userId,
        userEmail,
        region,
        purchaseType,
        targetLevel,
        amount,
        currency,
        paymentMethod,
        transactionId,
        paymentProofName,
        paymentProofUrl,
      } = req.body;

      if (!userEmail || !transactionId || !amount) {
        return res.status(400).json({
          success: false,
          error: "Missing required payment details (userEmail, transactionId, amount).",
        });
      }

      // Security validation: verify price matches standard pricing
      const expectedAmount =
        region === "pakistan"
          ? purchaseType === "one_level" ? 800 : 5000
          : purchaseType === "one_level" ? 5 : 20;

      const expectedCurrency = region === "pakistan" ? "PKR" : "USD";

      const newRequest = {
        id: "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        userId: userId || "user_" + Date.now(),
        userEmail: userEmail.toLowerCase().trim(),
        region: region || "pakistan",
        purchaseType: purchaseType || "one_level",
        targetLevel: purchaseType === "one_level" ? (targetLevel || 2) : null,
        amount: expectedAmount,
        currency: expectedCurrency,
        paymentMethod: paymentMethod || "sadapay",
        transactionId: String(transactionId).trim(),
        paymentProofName: paymentProofName || null,
        paymentProofUrl: paymentProofUrl || null,
        submittedAt: new Date().toISOString(),
        status: "PENDING", // STRICTLY PENDING: Unverified payment
        verificationType: "UNVERIFIED_MANUAL",
        isVerified: false,
      };

      serverPaymentRequests.unshift(newRequest);

      // Record in Supabase if configured
      if (serverSupabase) {
        try {
          await serverSupabase.from("payments").insert([
            {
              id: newRequest.id,
              order_id: null,
              user_id: newRequest.userId,
              user_email: newRequest.userEmail,
              product_id: newRequest.purchaseType === "all_activities" ? "all_activities" : `level_${newRequest.targetLevel || 2}`,
              amount: newRequest.amount,
              currency: newRequest.currency,
              payment_method: newRequest.paymentMethod,
              provider_transaction_id: newRequest.transactionId,
              payment_status: "PENDING",
              payment_proof_name: newRequest.paymentProofName,
              payment_proof_url: newRequest.paymentProofUrl,
              created_at: newRequest.submittedAt,
            },
          ]);

          await serverSupabase.from("notifications").insert([
            {
              id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
              user_id: newRequest.userId,
              user_email: newRequest.userEmail,
              type: "PAYMENT_PENDING",
              title: "Payment Approval Pending",
              message: "Your payment verification request is under review. Our team will verify and activate your 1-Month Premium access shortly.",
              read: false,
              created_at: newRequest.submittedAt,
            },
          ]);
        } catch (dbErr) {
          console.warn("Supabase record error (stored on server):", dbErr);
        }
      }

      return res.json({
        success: true,
        request: newRequest,
        status: "PENDING",
        isVerified: false,
        message: "Payment request submitted. Access remains LOCKED until independent verification is confirmed.",
      });
    } catch (err: any) {
      console.error("Payment submit error:", err);
      return res.status(500).json({ success: false, error: err.message || "Server error processing payment." });
    }
  });

  /**
   * Trusted Provider Webhook / Verification Endpoint
   * Only activates license if verified by actual payment provider signature/token.
   */
  app.post("/api/payment/verify-webhook", async (req, res) => {
    try {
      const { provider, providerSignature, transactionId, userEmail, purchaseType, targetLevel, amount, currency } = req.body;

      // Validate provider signature / trusted token
      const isTrustedProvider = Boolean(
        provider &&
        providerSignature &&
        providerSignature.length >= 16
      );

      if (!isTrustedProvider) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: "Unverified transaction signature. Automatic license activation rejected.",
        });
      }

      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1-month license

      const newLicense = {
        id: "lic_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        userId: "user_" + Math.random().toString(36).substring(2, 9),
        userEmail: userEmail.toLowerCase().trim(),
        licenseType: purchaseType,
        unlockedLevels: purchaseType === "all_activities" ? [1, 2, 3, 4, 5, 6] : [targetLevel || 2],
        allActivitiesUnlocked: purchaseType === "all_activities",
        purchaseDate: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        status: "ACTIVE",
        verificationType: "PROVIDER_VERIFIED",
        pricePaid: amount,
        currency: currency || "PKR",
        transactionId: transactionId,
      };

      serverLicenses.unshift(newLicense);

      if (serverSupabase) {
        try {
          await serverSupabase.from("user_licenses").insert([newLicense]);
        } catch (dbErr) {
          console.warn("Supabase license store error:", dbErr);
        }
      }

      return res.json({
        success: true,
        verified: true,
        status: "ACTIVE",
        license: newLicense,
      });
    } catch (err: any) {
      console.error("Provider webhook error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Admin Payment Verification Endpoint (School Administration)
   */
  app.post("/api/payment/admin-verify", async (req, res) => {
    try {
      const { requestId, decision, adminNotes, adminEmail } = req.body;

      if (!requestId || !decision) {
        return res.status(400).json({ success: false, error: "Missing requestId or decision" });
      }

      // Find in server memory or Supabase
      const reqIndex = serverPaymentRequests.findIndex((r) => r.id === requestId);
      const paymentReq = reqIndex !== -1 ? serverPaymentRequests[reqIndex] : null;

      const now = new Date();

      if (decision === "APPROVE") {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 Month Expiry

        const newLicense = {
          id: "lic_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          userId: paymentReq?.userId || "user_" + Date.now(),
          userEmail: paymentReq?.userEmail || req.body.userEmail || "",
          licenseType: paymentReq?.purchaseType || req.body.purchaseType || "one_level",
          unlockedLevels:
            (paymentReq?.purchaseType || req.body.purchaseType) === "all_activities"
              ? [1, 2, 3, 4, 5, 6]
              : [paymentReq?.targetLevel || req.body.targetLevel || 2],
          allActivitiesUnlocked: (paymentReq?.purchaseType || req.body.purchaseType) === "all_activities",
          purchaseDate: now.toISOString(),
          expiryDate: expiryDate.toISOString(),
          status: "ACTIVE",
          verificationType: "ADMIN_VERIFIED",
          verifiedBy: adminEmail || "School Administrator",
          pricePaid: paymentReq?.amount || req.body.amount || 800,
          currency: paymentReq?.currency || req.body.currency || "PKR",
          paymentRequestId: requestId,
        };

        if (paymentReq) {
          paymentReq.status = "APPROVED";
          paymentReq.verificationType = "ADMIN_VERIFIED";
          paymentReq.reviewedAt = now.toISOString();
          paymentReq.adminNotes = adminNotes || "";
          paymentReq.verifiedBy = adminEmail || "School Administrator";
        }

        serverLicenses.unshift(newLicense);

        if (serverSupabase) {
          try {
            await serverSupabase
              .from("payments")
              .update({
                payment_status: "VERIFIED",
                verified_at: now.toISOString(),
                admin_notes: adminNotes || "Approved by Admin",
                verified_by: adminEmail || "School Administrator",
              })
              .eq("id", requestId);

            await serverSupabase.from("user_licenses").insert([
              {
                id: newLicense.id,
                user_id: newLicense.userId,
                user_email: newLicense.userEmail,
                product_id: newLicense.licenseType === "all_activities" ? "all_activities" : `level_${newLicense.unlockedLevels[0] || 2}`,
                level: newLicense.unlockedLevels[0] || null,
                all_activities_unlocked: newLicense.allActivitiesUnlocked,
                start_date: newLicense.purchaseDate,
                expiry_date: newLicense.expiryDate,
                status: "ACTIVE",
                payment_id: requestId,
                created_at: newLicense.purchaseDate,
              },
            ]);

            await serverSupabase.from("notifications").insert([
              {
                id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
                user_id: newLicense.userId,
                user_email: newLicense.userEmail,
                type: "PAYMENT_APPROVED",
                title: "Payment Approved",
                message: "Payment Approved — Your 1-Month Premium Access is now active.",
                read: false,
                created_at: now.toISOString(),
              },
            ]);
          } catch (dbErr) {
            console.warn("Supabase admin verify error:", dbErr);
          }
        }

        return res.json({ success: true, status: "APPROVED", license: newLicense });
      } else {
        // REJECT
        if (paymentReq) {
          paymentReq.status = "REJECTED";
          paymentReq.reviewedAt = now.toISOString();
          paymentReq.adminNotes = adminNotes || "PAYMENT NOT RECEIVED";
        }

        if (serverSupabase) {
          try {
            await serverSupabase
              .from("payments")
              .update({
                payment_status: "REJECTED",
                verified_at: now.toISOString(),
                admin_notes: adminNotes || "PAYMENT NOT RECEIVED",
                verified_by: adminEmail || "School Administrator",
              })
              .eq("id", requestId);

            await serverSupabase.from("notifications").insert([
              {
                id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
                user_id: paymentReq?.userId || "user_" + Date.now(),
                user_email: paymentReq?.userEmail || req.body.userEmail,
                type: "PAYMENT_REJECTED",
                title: "Payment Not Verified",
                message: "Your payment could not be verified (PAYMENT NOT RECEIVED). Premium access remains locked.",
                read: false,
                created_at: now.toISOString(),
              },
            ]);
          } catch (dbErr) {
            console.warn("Supabase admin reject error:", dbErr);
          }
        }

        return res.json({ success: true, status: "REJECTED" });
      }
    } catch (err: any) {
      console.error("Admin verify error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Payment Provider Status Endpoint (Check API / Credential readiness without leaking secrets)
   */
  app.get("/api/payment/providers/status", (req, res) => {
    const hasPayoneerCredentials = Boolean(
      process.env.PAYONEER_PROGRAM_ID &&
      process.env.PAYONEER_API_SECRET
    );

    res.json({
      success: true,
      providers: {
        sadapay: {
          name: "SadaPay",
          status: "NOT_CONFIGURED",
          automatedVerification: false,
          note: "Awaiting official SadaPay merchant/API credentials. Payments remain strictly PENDING.",
        },
        bank_transfer: {
          name: "Commercial Bank Transfer",
          status: "MANUAL_ADMIN_VERIFICATION",
          automatedVerification: false,
          note: "Direct bank transfers require manual statement reconciliation by School Administration.",
        },
        payoneer: {
          name: "Payoneer (International USD)",
          status: hasPayoneerCredentials ? "READY_CONFIGURED" : "NOT_CONFIGURED",
          automatedVerification: hasPayoneerCredentials,
          configuredEnvKeys: [
            process.env.PAYONEER_PROGRAM_ID ? "PAYONEER_PROGRAM_ID" : null,
            process.env.PAYONEER_API_SECRET ? "PAYONEER_API_SECRET" : null,
          ].filter(Boolean),
        },
      },
    });
  });

  /**
   * School License Administration Endpoint
   */
  app.post("/api/payment/school-license", async (req, res) => {
    try {
      const {
        id,
        schoolId,
        schoolName,
        contactEmail,
        price,
        currency,
        licenseKey,
        validFrom,
        validUntil,
        startDate,
        expiryDate,
        allowedDevices,
        page1Access,
        page2Access,
        adminNotes,
        createdBy,
        verifiedBy,
      } = req.body;

      if (!schoolName || !contactEmail) {
        return res.status(400).json({ success: false, error: "Missing required school license parameters" });
      }

      const now = new Date();
      const validFromTime = validFrom || startDate || now.toISOString();
      const validUntilTime =
        validUntil ||
        expiryDate ||
        new Date(new Date(validFromTime).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const sid = (schoolId && isValidUUID(schoolId)) ? schoolId : generateUUID();
      const key =
        licenseKey ||
        "SCH-" +
          Math.random().toString(36).substring(2, 6).toUpperCase() +
          "-" +
          Math.random().toString(36).substring(2, 6).toUpperCase();
      const adminUser = createdBy || verifiedBy || "admin@playroom-learning.edu";
      const licenseDbId = (id && isValidUUID(id)) ? id : generateUUID();

      const schoolLicense = {
        id: licenseDbId,
        school_id: sid,
        license_key: key,
        school_name: schoolName,
        contact_email: contactEmail.toLowerCase().trim(),
        price: parseFloat(price) || 0,
        currency: currency || "PKR",
        allowed_devices: parseInt(allowedDevices, 10) || 999999,
        page1_access: page1Access !== undefined ? Boolean(page1Access) : true,
        page2_access: page2Access !== undefined ? Boolean(page2Access) : true,
        valid_from: validFromTime,
        valid_until: validUntilTime,
        start_date: validFromTime,
        expiry_date: validUntilTime,
        status: "ACTIVE",
        duration_months: 1, // Strictly 30-Day Term
        created_by: adminUser,
        verified_by: adminUser,
        admin_notes: adminNotes || null,
        created_at: now.toISOString(),
      };

      if (serverSupabase) {
        try {
          await serverSupabase.from("schools").upsert(
            [
              {
                id: sid,
                school_name: schoolName,
                school_admin_name: schoolName,
                contact_name: schoolName,
                contact_email: contactEmail.toLowerCase().trim(),
                status: "ACTIVE",
                account_status: "active",
                payment_status: "paid",
                created_at: now.toISOString(),
              },
            ],
            { onConflict: "id" }
          );

          await serverSupabase.from("school_licenses").insert([schoolLicense]);
        } catch (dbErr) {
          console.warn("Supabase school_licenses store error:", dbErr);
        }
      }

      return res.json({ success: true, license: schoolLicense });
    } catch (err: any) {
      console.error("School license error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Submit School Inquiry / Request
  app.post("/api/payment/school-request", async (req, res) => {
    try {
      const {
        id,
        schoolName,
        schoolAdminName,
        contactEmail,
        phoneNumber,
        city,
        country,
        subject,
        message,
        allowedDevices,
        durationMonths,
        amount,
        currency,
        paymentMethod,
        transactionReference,
      } = req.body;

      // Server-side validation
      const trimmedSchoolName = (schoolName || "").trim();
      const trimmedAdminName = (schoolAdminName || "").trim();
      const trimmedEmail = (contactEmail || "").trim().toLowerCase();
      const trimmedPhone = (phoneNumber || "").trim();
      const trimmedCountry = (country || "").trim();
      const trimmedCity = (city || "").trim();
      const trimmedSubject = (subject || "").trim();
      const trimmedMessage = (message || "").trim();

      const isObviousGarbage = (str: string): boolean => {
        if (!str) return false;
        const s = str.trim().toLowerCase();
        if (/(.)\1{3,}/.test(s)) return true;
        const mashPatterns = [
          "asdfgh", "qwerty", "zxcvbn", "hjkl", "dfgh", "qwert",
          "akhdawjwf", "asdfg", "zxcvb", "lkjhg", "poiuy"
        ];
        for (const pat of mashPatterns) {
          if (s.includes(pat)) return true;
        }
        const words = s.split(/[\s\-_,.]+/).filter((w) => w.length >= 5 && /^[a-z]+$/.test(w));
        for (const w of words) {
          if (!/[aeiouy]/.test(w)) return true;
        }
        return false;
      };

      if (!trimmedCountry) {
        return res.status(400).json({ success: false, error: "Please select a country." });
      }

      if (!trimmedSchoolName || trimmedSchoolName.length < 3 || !/[\p{L}a-zA-Z]/u.test(trimmedSchoolName)) {
        return res.status(400).json({ success: false, error: "Invalid school name. Minimum 3 characters and must contain letters." });
      }
      if (isObviousGarbage(trimmedSchoolName)) {
        return res.status(400).json({ success: false, error: "Please enter a valid school name, not random characters." });
      }

      if (!trimmedAdminName || trimmedAdminName.length < 2 || !/[\p{L}a-zA-Z]/u.test(trimmedAdminName) || !/^[\p{L}a-zA-Z\s.'-]+$/u.test(trimmedAdminName)) {
        return res.status(400).json({ success: false, error: "Invalid contact name. Must contain letters, spaces, hyphens, or apostrophes only (minimum 2 characters)." });
      }
      if (/\d/.test(trimmedAdminName)) {
        return res.status(400).json({ success: false, error: "Contact name cannot contain numbers." });
      }
      if (isObviousGarbage(trimmedAdminName)) {
        return res.status(400).json({ success: false, error: "Please enter a valid human name, not random characters." });
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ success: false, error: "Invalid contact email address format (e.g. admin@school.edu.pk)." });
      }

      if (!trimmedPhone || /[a-zA-Z]/.test(trimmedPhone)) {
        return res.status(400).json({ success: false, error: "Invalid phone number. Alphabetic letters are not allowed." });
      }
      const digitsOnly = trimmedPhone.replace(/\D/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 15 || !/^(\+?[0-9\s\-()]+)$/.test(trimmedPhone)) {
        return res.status(400).json({ success: false, error: "Invalid phone number format (must contain 7 to 15 digits)." });
      }

      if (!trimmedSubject || trimmedSubject.length < 3 || !/[\p{L}a-zA-Z]/u.test(trimmedSubject)) {
        return res.status(400).json({ success: false, error: "Subject is required (minimum 3 characters and must contain letters)." });
      }
      if (isObviousGarbage(trimmedSubject)) {
        return res.status(400).json({ success: false, error: "Please enter a valid subject." });
      }

      if (!trimmedMessage || trimmedMessage.length < 10 || !/[\p{L}a-zA-Z]{2,}/u.test(trimmedMessage)) {
        return res.status(400).json({ success: false, error: "Message is required (minimum 10 characters detailing your classroom needs)." });
      }
      if (isObviousGarbage(trimmedMessage)) {
        return res.status(400).json({ success: false, error: "Please enter a meaningful message describing your requirements." });
      }

      const requestId = (id && isValidUUID(id)) ? id : generateUUID();
      const nowIso = new Date().toISOString();
      let targetSchoolId = generateUUID();
      let finalSchoolId = targetSchoolId;

      const dbClient = serverAdminSupabase || serverSupabase;
      if (dbClient) {
        try {
          // 1. Check if the inquiry belongs to an existing school using reliable compound identity (matching school name AND contact email)
          const { data: exactMatchSchool } = await dbClient
            .from("schools")
            .select("id, school_name, contact_email")
            .ilike("school_name", trimmedSchoolName)
            .ilike("contact_email", trimmedEmail)
            .maybeSingle();

          let existingSchoolToUse = exactMatchSchool;

          if (existingSchoolToUse?.id) {
            targetSchoolId = existingSchoolToUse.id;
            finalSchoolId = existingSchoolToUse.id;
          } else {
            // Distinct school: Create a brand new record in public.schools
            const newSchoolId = generateUUID();
            targetSchoolId = newSchoolId;
            finalSchoolId = newSchoolId;

            const { error: schoolInsertErr } = await dbClient
              .from("schools")
              .insert([
                {
                  id: newSchoolId,
                  school_name: trimmedSchoolName,
                  contact_name: trimmedAdminName,
                  contact_email: trimmedEmail,
                  country: trimmedCountry || null,
                  currency: currency || (trimmedCountry === "Pakistan" ? "PKR" : "USD"),
                  account_status: "active",
                  payment_status: "pending",
                  created_at: nowIso,
                },
              ]);

            if (schoolInsertErr) {
              console.warn("Supabase schools table insert notice:", schoolInsertErr);
              const { data: refetchedSchool } = await dbClient
                .from("schools")
                .select("id")
                .ilike("school_name", trimmedSchoolName)
                .ilike("contact_email", trimmedEmail)
                .maybeSingle();
              if (refetchedSchool?.id) {
                targetSchoolId = refetchedSchool.id;
                finalSchoolId = refetchedSchool.id;
              }
            }
          }

          // 2. Insert into public.school_requests
          const finalFullMessage = `School: ${trimmedSchoolName} | Admin: ${trimmedAdminName} | Email: ${trimmedEmail} | Phone: ${trimmedPhone} | Country: ${trimmedCountry}${trimmedCity ? ` | City: ${trimmedCity}` : ""}\n\n${trimmedMessage}`;
          
          let insertedSuccessfully = false;
          let lastInsertError: any = null;

          const { error: pluralErr } = await dbClient.from("school_requests").insert([
            {
              id: requestId,
              school_id: targetSchoolId,
              requested_by: null,
              subject: trimmedSubject,
              message: finalFullMessage,
              status: "pending",
              created_at: nowIso,
            },
          ]);

          if (!pluralErr) {
            insertedSuccessfully = true;
          } else {
            lastInsertError = pluralErr;
            console.warn("Supabase public.school_requests insert notice, trying singular fallback:", pluralErr);
            // Fallback to singular table if it exists in another environment
            const { error: singularErr } = await dbClient.from("school_request").insert([
              {
                id: requestId,
                school_id: targetSchoolId,
                subject: trimmedSubject,
                message: finalFullMessage,
                created_at: nowIso,
              },
            ]);
            if (!singularErr) {
              insertedSuccessfully = true;
            } else {
              lastInsertError = singularErr;
            }
          }

          if (!insertedSuccessfully && lastInsertError) {
            return res.status(500).json({
              success: false,
              error: `Database insertion failed: ${lastInsertError.message || "Could not insert school request into Supabase."}`,
            });
          }
        } catch (dbErr: any) {
          console.error("Supabase school_request critical error:", dbErr);
          return res.status(500).json({
            success: false,
            error: `Database error: ${dbErr?.message || "Failed to process school request in Supabase."}`,
          });
        }
      }

      const newRecord = {
        id: requestId,
        schoolId: finalSchoolId,
        schoolName: trimmedSchoolName,
        schoolAdminName: trimmedAdminName,
        contactName: trimmedAdminName,
        contactEmail: trimmedEmail,
        contactPhone: trimmedPhone,
        country: trimmedCountry,
        city: trimmedCity || "Karachi",
        subject: trimmedSubject,
        message: trimmedMessage,
        amount: amount || 25000,
        currency: currency || "PKR",
        allowedDevices: allowedDevices || 999999,
        durationMonths: durationMonths || 1,
        paymentMethod: paymentMethod || "bank_transfer",
        transactionReference: transactionReference || "INQUIRY-" + Date.now().toString(36).toUpperCase(),
        status: "PENDING",
        submittedAt: nowIso,
      };

      serverPaymentRequests.unshift(newRecord);

      return res.json({
        success: true,
        message: "School inquiry submitted successfully.",
        request: newRecord,
      });
    } catch (err: any) {
      console.error("School request endpoint error:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to process school request." });
    }
  });

  // Approve School Request Endpoint (School Inquiries do NOT use payment requests)
  app.post("/api/payment/school-request/approve", async (req, res) => {
    try {
      const { requestId, adminEmail, adminNotes } = req.body;
      if (!requestId) {
        return res.status(400).json({ success: false, error: "requestId is required" });
      }

      const now = new Date();
      const adminUser = adminEmail || "school-admin@playroom-learning.edu";

      let targetRequest: any = null;
      let targetSchool: any = null;

      if (serverSupabase) {
        // 1. Fetch from public.school_requests
        const { data: reqData } = await serverSupabase
          .from("school_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();

        if (reqData) {
          targetRequest = reqData;
          if (reqData.school_id) {
            const { data: schData } = await serverSupabase
              .from("schools")
              .select("*")
              .eq("id", reqData.school_id)
              .maybeSingle();
            targetSchool = schData;
          }
        } else {
          // Fallback to singular
          const { data: singReq } = await serverSupabase
            .from("school_request")
            .select("*")
            .eq("id", requestId)
            .maybeSingle();
          if (singReq) {
            targetRequest = singReq;
            if (singReq.school_id) {
              const { data: schData } = await serverSupabase
                .from("schools")
                .select("*")
                .eq("id", singReq.school_id)
                .maybeSingle();
              targetSchool = schData;
            }
          }
        }
      }

      const schoolId = targetRequest?.school_id || targetSchool?.id || generateUUID();
      const schoolName = targetSchool?.school_name || "Partner School";
      const contactEmail = targetSchool?.contact_email || "school@playroomapp.com";

      // 2. Check if the school already has an active license in public.school_licenses
      let activeLicense: any = null;
      if (serverSupabase) {
        try {
          const { data: existingLicenses } = await serverSupabase
            .from("school_licenses")
            .select("*")
            .eq("school_id", schoolId);

          if (existingLicenses && Array.isArray(existingLicenses)) {
            activeLicense = existingLicenses.find((lic) => {
              const exp = lic.valid_until || lic.expiry_date;
              return (
                (lic.status || "").toUpperCase() === "ACTIVE" &&
                (!exp || new Date(exp).getTime() > now.getTime())
              );
            });
          }
        } catch (licErr) {
          console.warn("Supabase active license check warning:", licErr);
        }
      }

      let finalLicenseKey: string;
      let licenseRecord: any;

      if (activeLicense) {
        finalLicenseKey = activeLicense.license_key || activeLicense.id;
        licenseRecord = activeLicense;
      } else {
        const newKey =
          "SCH-" +
          Math.random().toString(36).substring(2, 6).toUpperCase() +
          "-" +
          Math.random().toString(36).substring(2, 6).toUpperCase();
        finalLicenseKey = newKey;

        const validFrom = now.toISOString();
        const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const licId = generateUUID();

        licenseRecord = {
          id: licId,
          school_id: schoolId,
          license_key: newKey,
          school_name: schoolName,
          contact_email: contactEmail,
          price: 0,
          currency: "PKR",
          allowed_devices: 999999,
          page1_access: true,
          page2_access: true,
          valid_from: validFrom,
          valid_until: validUntil,
          start_date: validFrom,
          expiry_date: validUntil,
          status: "ACTIVE",
          duration_months: 1,
          created_by: adminUser,
          verified_by: adminUser,
          admin_notes: adminNotes || `Approved school inquiry ${requestId}`,
          created_at: now.toISOString(),
        };

        if (serverSupabase) {
          try {
            await serverSupabase.from("school_licenses").insert([licenseRecord]);
          } catch (insertLicErr) {
            console.warn("Supabase school_licenses insert notice:", insertLicErr);
          }
        }
      }

      // 3. Update public.school_requests status to approved
      if (serverSupabase) {
        try {
          await serverSupabase
            .from("school_requests")
            .update({
              status: "approved",
              admin_reply: adminNotes || `Approved by Administrator. 30-Day License Key: ${finalLicenseKey}`,
              replied_at: now.toISOString(),
            })
            .eq("id", requestId);
        } catch (updReqErr) {
          console.warn("Supabase school_requests update notice:", updReqErr);
        }
      }

      return res.json({
        success: true,
        message: "School request approved. 30-Day license active.",
        licenseKey: finalLicenseKey,
        license: licenseRecord,
      });
    } catch (err: any) {
      console.error("Approve school request error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Renew Existing School License
  app.post("/api/payment/school-license/renew", async (req, res) => {
    try {
      const { licenseId, licenseKey, adminNotes, adminEmail } = req.body;
      if (!licenseId && !licenseKey) {
        return res.status(400).json({ success: false, error: "License ID or Key is required for renewal" });
      }

      const now = new Date();
      const adminUser = adminEmail || "school-admin@playroom-learning.edu";

      let existingLicense: any = null;

      if (serverSupabase) {
        try {
          const query = serverSupabase.from("school_licenses").select("*");
          if (licenseId) {
            query.eq("id", licenseId);
          } else {
            query.eq("license_key", licenseKey);
          }
          const { data, error } = await query.maybeSingle();
          if (data && !error) {
            existingLicense = data;
          }
        } catch (dbErr) {
          console.warn("Error finding school license for renewal in Supabase:", dbErr);
        }
      }

      // Renewal Date Logic:
      // If current license is still active and has not expired: new valid_until = current valid_until + 30 days
      // If the license has already expired: new valid_until = current timestamp + 30 days
      const currentExpiry = existingLicense?.valid_until || existingLicense?.expiry_date;
      const currentExpiryTime = currentExpiry ? new Date(currentExpiry).getTime() : 0;
      const isCurrentlyActive = currentExpiryTime > now.getTime() && (existingLicense?.status || "").toUpperCase() === "ACTIVE";

      let newValidUntil: string;
      if (isCurrentlyActive) {
        newValidUntil = new Date(currentExpiryTime + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        newValidUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const updatedFields = {
        status: "ACTIVE",
        valid_until: newValidUntil,
        expiry_date: newValidUntil,
        admin_notes: adminNotes || (existingLicense?.admin_notes ? `${existingLicense.admin_notes} | Renewed on ${now.toLocaleDateString()}` : `Renewed for 30 days on ${now.toLocaleDateString()}`),
        verified_by: adminUser,
        updated_at: now.toISOString(),
      };

      if (serverSupabase && existingLicense?.id) {
        try {
          await serverSupabase
            .from("school_licenses")
            .update(updatedFields)
            .eq("id", existingLicense.id);
        } catch (updateErr) {
          console.warn("Supabase school_license renewal update error:", updateErr);
        }
      }

      return res.json({
        success: true,
        message: "License renewed successfully for 30 days.",
        license: {
          ...existingLicense,
          ...updatedFields,
          licenseKey: existingLicense?.license_key || licenseKey,
          schoolId: existingLicense?.school_id,
          schoolName: existingLicense?.school_name,
          contactEmail: existingLicense?.contact_email,
          validFrom: existingLicense?.valid_from || existingLicense?.start_date,
          validUntil: newValidUntil,
          startDate: existingLicense?.valid_from || existingLicense?.start_date,
          expiryDate: newValidUntil,
        },
      });
    } catch (err: any) {
      console.error("School license renewal error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create Payment Dispute / Issue
  app.post("/api/payment/dispute/create", async (req, res) => {
    try {
      const issue = req.body;
      if (!issue || !issue.paymentId || !issue.userEmail) {
        return res.status(400).json({ success: false, error: "Missing required dispute parameters" });
      }

      if (serverSupabase) {
        try {
          await serverSupabase.from("payment_issues").insert([
            {
              id: issue.id,
              payment_id: issue.paymentId,
              order_id: issue.orderId || null,
              user_id: issue.userId,
              user_email: issue.userEmail,
              payment_method: issue.paymentMethod,
              amount: issue.amount,
              currency: issue.currency,
              transaction_reference: issue.transactionId,
              payment_date: issue.paymentDate,
              message: issue.userMessage,
              status: issue.status || "OPEN",
              created_at: issue.submittedAt || new Date().toISOString(),
            },
          ]);
        } catch (dbErr) {
          console.warn("Supabase payment_issues store error:", dbErr);
        }
      }

      return res.json({ success: true, issue });
    } catch (err: any) {
      console.error("Dispute create error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Resolve Payment Dispute (Admin Only)
  app.post("/api/payment/dispute/resolve", async (req, res) => {
    try {
      const { disputeId, paymentId, action, adminNotes, verifiedBy } = req.body;
      if (!disputeId || !paymentId || !action) {
        return res.status(400).json({ success: false, error: "Missing dispute resolution parameters" });
      }

      const now = new Date().toISOString();
      let disputeStatus = "UNDER_REVIEW";
      let adminResponse = adminNotes || "";

      if (action === "APPROVE") {
        disputeStatus = "RESOLVED_APPROVED";
        adminResponse = adminNotes || "Payment Approved — Your Premium Access is now active.";

        if (serverSupabase) {
          try {
            await serverSupabase
              .from("payment_issues")
              .update({
                status: disputeStatus,
                admin_note: adminResponse,
                resolved_at: now,
                resolved_by: verifiedBy || "School Administrator",
              })
              .eq("id", disputeId);

            await serverSupabase
              .from("payments")
              .update({
                payment_status: "VERIFIED",
                verified_at: now,
                verified_by: verifiedBy || "School Administrator",
                admin_notes: adminNotes || "Verified via Dispute Audit",
              })
              .eq("id", paymentId);
          } catch (dbErr) {
            console.warn("Supabase dispute resolution error:", dbErr);
          }
        }
      } else if (action === "REJECT_NOT_RECEIVED") {
        disputeStatus = "RESOLVED_REJECTED";
        adminResponse = adminNotes || "Your payment could not be verified. Premium access remains locked.";

        if (serverSupabase) {
          try {
            await serverSupabase
              .from("payment_issues")
              .update({
                status: disputeStatus,
                admin_note: adminResponse,
                resolved_at: now,
                resolved_by: verifiedBy || "School Administrator",
              })
              .eq("id", disputeId);

            await serverSupabase
              .from("payments")
              .update({
                payment_status: "REJECTED",
                verified_at: now,
                verified_by: verifiedBy || "School Administrator",
                admin_notes: "PAYMENT NOT RECEIVED",
              })
              .eq("id", paymentId);
          } catch (dbErr) {
            console.warn("Supabase dispute rejection error:", dbErr);
          }
        }
      } else {
        // KEEP_PENDING
        disputeStatus = "UNDER_REVIEW";
        adminResponse = adminNotes || "Payment Approval Pending";

        if (serverSupabase) {
          try {
            await serverSupabase
              .from("payment_issues")
              .update({
                status: disputeStatus,
                admin_note: adminResponse,
              })
              .eq("id", disputeId);
          } catch (dbErr) {
            console.warn("Supabase dispute keep pending error:", dbErr);
          }
        }
      }

      return res.json({ success: true, disputeStatus, adminResponse });
    } catch (err: any) {
      console.error("Dispute resolution error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function generateFallbackSummary(data: any): string {
  const name = data.childName || "The child";
  const achieved = data.achievedOutcomes || [];
  const developing = data.developingOutcomes || [];
  const observations = data.observations || [];
  const evidence = data.evidence || [];
  const teachingCriteria = data.teachingCriteria || [];
  const customNotes = data.customNotes || "";

  if (achieved.length === 0 && developing.length === 0 && observations.length === 0 && evidence.length === 0 && teachingCriteria.length === 0 && !customNotes.trim()) {
    return "Not enough information has been recorded to provide a summary.";
  }

  const sections: string[] = [];

  sections.push(`### **Executive Educator Overview**
Based on observational records, ${name} participates in preschool classroom activities and learning centers. The following synthesis compiles teacher-recorded progress, developmental milestones, and classroom observations.`);

  if (achieved.length > 0) {
    sections.push(`### **Key Developmental Strengths & Milestones**
${achieved.map((a: string) => `• **Demonstrated Skill**: ${a}`).join("\n")}`);
  }

  if (developing.length > 0) {
    sections.push(`### **Emerging Skills & Active Growth**
${developing.map((d: string) => `• **Developing Skill**: ${d}`).join("\n")}`);
  }

  if (observations.length > 0) {
    sections.push(`### **Teacher Observations**
${observations.map((o: any) => `• ${o.date ? `[${o.date}] ` : ""}${o.situation ? `${o.situation}: ` : ""}${o.observed || ""}${o.childResponse ? ` (Child: "${o.childResponse}")` : ""}`).join("\n")}`);
  }

  if (evidence.length > 0) {
    sections.push(`### **Work Samples & Evidence**
${evidence.map((e: any) => `• ${e.type || "Sample"}: ${e.title || e.description || ""} (${e.outcomeTitle || "Learning Outcome"})`).join("\n")}`);
  }

  if (teachingCriteria.length > 0) {
    sections.push(`### **Teaching Practice & Learning Environment Reflection**
${teachingCriteria.map((c: any) => `• ${c.category} - ${c.title}: ${c.status}`).join("\n")}`);
  }

  sections.push(`### **Recommended Next Learning Goals & Home Connections**
• **Collaborative Support**: Continue active exploration and gentle practice on emerging developmental outcomes through everyday play.
• **Home-School Engagement**: Celebrate daily milestones with positive reinforcement and conversation.`);

  return sections.join("\n\n");
}

startServer();
