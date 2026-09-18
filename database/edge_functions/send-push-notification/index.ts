// ================================================================
// Supabase Edge Function: send-push-notification
// Deploy: supabase functions deploy send-push-notification
//
// Environment Variables (set in Supabase Dashboard → Settings → Edge Functions):
//   FIREBASE_PROJECT_ID   = "zabardast-c4e25"
//   FIREBASE_CLIENT_EMAIL = "firebase-adminsdk-fbsvc@zabardast-c4e25.iam.gserviceaccount.com"
//   FIREBASE_PRIVATE_KEY  = managed secret (no source-code fallback)
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function requireEnv(name: string): string {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const FIREBASE_PROJECT_ID = requireEnv("FIREBASE_PROJECT_ID");
const FIREBASE_CLIENT_EMAIL = requireEnv("FIREBASE_CLIENT_EMAIL");
const FIREBASE_PRIVATE_KEY = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

// ─── Helper: Proper base64url encoding (required for JWT) ────────────────────
// btoa() gives standard base64 with +, /, = — JWT needs base64url with -, _, no padding
function toBase64Url(data: string | Uint8Array): string {
    let bytes: Uint8Array;
    if (typeof data === "string") {
        bytes = new TextEncoder().encode(data);
    } else {
        bytes = data;
    }
    // Convert bytes to binary string safely (avoids spread operator stack overflow)
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

// ─── Get Firebase OAuth2 Access Token ────────────────────────────────────────
async function getFirebaseAccessToken(): Promise<string> {
    const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const payload = toBase64Url(JSON.stringify({
        iss: FIREBASE_CLIENT_EMAIL,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    }));

    // Strip PEM headers and whitespace to get raw base64
    const pemContents = FIREBASE_PRIVATE_KEY
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\s+/g, "");

    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signingInput = `${header}.${payload}`;
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        privateKey,
        new TextEncoder().encode(signingInput)
    );

    // FIX: use toBase64Url with Uint8Array (no spread operator crash)
    const jwt = `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Firebase token fetch failed: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        throw new Error(`No access_token in response: ${JSON.stringify(tokenData)}`);
    }
    return tokenData.access_token;
}

// ─── Send FCM Push to a Single Token ─────────────────────────────────────────
async function sendFCMPush(
    accessToken: string,
    fcmToken: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
): Promise<{ ok: boolean; token: string }> {
    const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: {
                    token: fcmToken,
                    notification: { title, body },
                    data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
                    android: {
                        priority: "high",
                        notification: { sound: "default", channel_id: "zabardast_channel" },
                    },
                    apns: {
                        payload: { aps: { sound: "default", badge: 1 } },
                    },
                },
            }),
        }
    );

    if (!res.ok) {
        const errBody = await res.text();
        console.warn(`FCM failed for token ${fcmToken.slice(0, 20)}...: ${errBody}`);
    }

    return { ok: res.ok, token: fcmToken };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await req.json();
        const {
            user_id,
            user_ids,
            title,
            body: msgBody,
            notification_type,
            data: extraData,
        } = body as {
            user_id?: string;
            user_ids?: string[];
            title: string;
            body: string;
            notification_type?: string;
            data?: Record<string, string>;
        };

        if (!title || !msgBody) {
            return new Response(
                JSON.stringify({ error: "title and body are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Fetch user_ids of verified students only
        const { data: verifiedProfiles } = await supabase
            .from("student_profiles_t")
            .select("user_id")
            .eq("is_verified", true);

        const verifiedUserIds = (verifiedProfiles || []).map((p: any) => p.user_id);

        if (verifiedUserIds.length === 0) {
            return new Response(
                JSON.stringify({ success: true, sent: 0, message: "No verified students found to send notifications to" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        const targetUserIds = user_id ? [user_id] : (user_ids && user_ids.length > 0 ? user_ids : verifiedUserIds);

        // Build query — restricted to active FCM tokens of verified students
        let query = supabase
            .from("user_push_tokens_t")
            .select("fcm_token, user_id")
            .eq("is_active", true)
            .in("user_id", targetUserIds);

        const { data: tokens, error: dbError } = await query;
        if (dbError) throw new Error(`DB error: ${dbError.message}`);

        if (!tokens || tokens.length === 0) {
            return new Response(
                JSON.stringify({ success: true, sent: 0, message: "No active tokens found" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        const accessToken = await getFirebaseAccessToken();
        const pushData: Record<string, string> = {
            notification_type: notification_type ?? "SYS",
            ...(extraData ?? {}),
        };

        // Send to all tokens in parallel
        // deno-lint-ignore no-explicit-any
        const results = await Promise.allSettled(
            (tokens as any[]).map((t) =>
                sendFCMPush(accessToken, t.fcm_token as string, title, msgBody, pushData)
            )
        );

        // FIX: Properly narrow PromiseSettledResult — r.value only exists on fulfilled results
        type PushResult = { ok: boolean; token: string };
        const fulfilled = results.filter(
            (r): r is PromiseFulfilledResult<PushResult> => r.status === "fulfilled"
        );
        const sent = fulfilled.filter((r) => r.value.ok).length;
        const failed = results.length - sent;

        return new Response(
            JSON.stringify({ success: true, sent, failed, total: tokens.length }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    } catch (err: unknown) {
        // FIX: TypeScript unknown type — safely extract message
        const message = err instanceof Error ? err.message : String(err);
        console.error("Push notification error:", message);
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
