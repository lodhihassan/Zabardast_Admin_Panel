// ================================================================
// Supabase Edge Function: send-push-notification
// Deploy: supabase functions deploy send-push-notification
//
// Environment Variables (set in Supabase Dashboard → Settings → Edge Functions):
//   FIREBASE_PROJECT_ID   = "zabardast-c4e25"
//   FIREBASE_CLIENT_EMAIL = "firebase-adminsdk-fbsvc@zabardast-c4e25.iam.gserviceaccount.com"
//   FIREBASE_PRIVATE_KEY  = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDlG9u2Gu2h1kOj\nR7hJQIS4MPefMIIvxqFw/m6vkhgfiv8T3W/DeKybPfkSng1UHlAtJhj1BByXtshO\nXnmCqsHB8cDwq4ewhDvxEuIqEvnHwgo5zZg8lLZ1dPxWlNrO0H/lMgstSAMNNLqE\nUQDjupZ688og/IQkGPOrCEaqcS64n1TKUehwJUZbFNFWXm8Ai5x5CXMRH7/V7buw\npJl6RhUOheTBHDShFae4NcVKlDT/A9U/lPQsZl4+KlVxuAOofZTObywWq7oov/pn\nKj1YfnDhK14MdrqBDHcyjlemz1Xv41oXaul2JI3OPRReYc76T1jmMAQ637c3brC8\nNanrW9mnAgMBAAECggEALuxeOvVX7xnxn2rseQBATnMk/BMUztEpNnm91LKgwzEW\nHgzvu4KnI2J1dVUumKhetmiDmwb9DiuO6dIao+LyLRUk9YXEFCh5GF5MON7LDpkU\nvBL6F4pDtlm/5sG08L+uOhReSqdhjJ5chwYKHxoTgNoWb1wYekYr/b8DrhvhPElu\ndJ+EInEH1H2uQgR0bJcpsm73HljXVxkhDM/2LRXfFTRl6/JalCtMs0UACoD7hxKK\njXYnKXk5tIYx60sG5Ceubw9kYZVpCGpRxr1T/hYHMyDU3lmJxNL7Hp+wdPk07xoL\ndCMCdYCQ38oBP48QRM3cx3H2c5T/4IVW8SmbdwBH2QKBgQD6HcB5tDNwg6Z5fELv\nhpmXdJdDKgYyrqxf/mc9nWspM9Wpx+GfXvMl8I0YMNEEnoc8SXRrMxfVJgPSSj/I\n67lxZlhtbzG1+POhW6ZAWlYSoIzvf0mYGy3CbOwmWZMnwSMcAD4Zf0rSodw1e6X0\nzplXV9V+1qs7A8FW+H6o6YTXLwKBgQDqf5iFyLXlG845paAhAAXoHHlnsXgF8LpN\npodq2k7ee6aWOomF//v7q69w44n9dkGwmggmCHi1+gIh+IE39XeZTtI38iimqxNq\n7J3ALpKdiCZGg9KzN7qaYh39hsOWSKH2xnEqjHRQ0/+74vJ6oTugR9txeptG5Nsp\n02uKlZIHCQKBgAFySJmrlByTdlP/hveRpLO+hd1qkcybO/32H6y4i1UaqqKnuENO\nrkNK59X6+kp3jDqqBhVUn0+pP55otYO48UKZn+tKGFSAExCc0hJPM246JXaBGvDZ\nP2N/c8IpBHPXZxeTXMiS9uDO9NIOXABVbYeWx3JLVYQq2mRhXYImj5EbAoGANz/i\n3rqAaL+ZYimsxbmsqphy3kSJA9VI/9yZkUpoRLEbec/G8SRz6UL1LgLeUzKWnZZd\nDyD11+JUuE5Fm7qg+CUDEJ1kiIhMJegj7tDKSIV4hyqt7P3XYGJ3sHEdCf6I8oyk\nwyKekSCx40HAYbY1RzlG8cCybwyiuoMOlnNRGYkCgYALe48bxkoaE4NIq9l6teay\nRTGpnRDfKG0MKpvD16+obUT5Y79q1iZvMRuID+8rkgNlMKlh9Tj+hjwDLRWgY9Mx\nmk21BddrkVV5PLPvQs1ef6ZcLBTypp/IhpayEyontLaMYl2vPY2txme3ht+UwjaF\ncF6+bE1VF12Mc9DjYVZUAg==\n-----END PRIVATE KEY-----\n",
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "zabardast-c4e25";
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "firebase-adminsdk-fbsvc@zabardast-c4e25.iam.gserviceaccount.com";
const rawPrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY") || `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDlG9u2Gu2h1kOj\nR7hJQIS4MPefMIIvxqFw/m6vkhgfiv8T3W/DeKybPfkSng1UHlAtJhj1BByXtshO\nXnmCqsHB8cDwq4ewhDvxEuIqEvnHwgo5zZg8lLZ1dPxWlNrO0H/lMgstSAMNNLqE\nUQDjupZ688og/IQkGPOrCEaqcS64n1TKUehwJUZbFNFWXm8Ai5x5CXMRH7/V7buw\npJl6RhUOheTBHDShFae4NcVKlDT/A9U/lPQsZl4+KlVxuAOofZTObywWq7oov/pn\nKj1YfnDhK14MdrqBDHcyjlemz1Xv41oXaul2JI3OPRReYc76T1jmMAQ637c3brC8\nNanrW9mnAgMBAAECggEALuxeOvVX7xnxn2rseQBATnMk/BMUztEpNnm91LKgwzEW\nHgzvu4KnI2J1dVUumKhetmiDmwb9DiuO6dIao+LyLRUk9YXEFCh5GF5MON7LDpkU\nvBL6F4pDtlm/5sG08L+uOhReSqdhjJ5chwYKHxoTgNoWb1wYekYr/b8DrhvhPElu\ndJ+EInEH1H2uQgR0bJcpsm73HljXVxkhDM/2LRXfFTRl6/JalCtMs0UACoD7hxKK\njXYnKXk5tIYx60sG5Ceubw9kYZVpCGpRxr1T/hYHMyDU3lmJxNL7Hp+wdPk07xoL\ndCMCdYCQ38oBP48QRM3cx3H2c5T/4IVW8SmbdwBH2QKBgQD6HcB5tDNwg6Z5fELv\nhpmXdJdDKgYyrqxf/mc9nWspM9Wpx+GfXvMl8I0YMNEEnoc8SXRrMxfVJgPSSj/I\n67lxZlhtbzG1+POhW6ZAWlYSoIzvf0mYGy3CbOwmWZMnwSMcAD4Zf0rSodw1e6X0\nzplXV9V+1qs7A8FW+H6o6YTXLwKBgQDqf5iFyLXlG845paAhAAXoHHlnsXgF8LpN\npodq2k7ee6aWOomF//v7q69w44n9dkGwmggmCHi1+gIh+IE39XeZTtI38iimqxNq\n7J3ALpKdiCZGg9KzN7qaYh39hsOWSKH2xnEqjHRQ0/+74vJ6oTugR9txeptG5Nsp\n02uKlZIHCQKBgAFySJmrlByTdlP/hveRpLO+hd1qkcybO/32H6y4i1UaqqKnuENO\nrkNK59X6+kp3jDqqBhVUn0+pP55otYO48UKZn+tKGFSAExCc0hJPM246JXaBGvDZ\nP2N/c8IpBHPXZxeTXMiS9uDO9NIOXABVbYeWx3JLVYQq2mRhXYImj5EbAoGANz/i\n3rqAaL+ZYimsxbmsqphy3kSJA9VI/9yZkUpoRLEbec/G8SRz6UL1LgLeUzKWnZZd\nDyD11+JUuE5Fm7qg+CUDEJ1kiIhMJegj7tDKSIV4hyqt7P3XYGJ3sHEdCf6I8oyk\nwyKekSCx40HAYbY1RzlG8cCybwyiuoMOlnNRGYkCgYALe48bxkoaE4NIq9l6teay\nRTGpnRDfKG0MKpvD16+obUT5Y79q1iZvMRuID+8rkgNlMKlh9Tj+hjwDLRWgY9Mx\nmk21BddrkVV5PLPvQs1ef6ZcLBTypp/IhpayEyontLaMYl2vPY2txme3ht+UwjaF\ncF6+bE1VF12Mc9DjYVZUAg==\n-----END PRIVATE KEY-----\n`;
const FIREBASE_PRIVATE_KEY = rawPrivateKey.replace(/\\n/g, "\n");

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
