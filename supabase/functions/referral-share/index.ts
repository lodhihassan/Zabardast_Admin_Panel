// ================================================================
// Supabase Edge Function: referral-share
// Direct HTTP 302 Redirect to Google Drive APK for testing
// Deploy command: supabase functions deploy referral-share --no-verify-jwt
// ================================================================

const GOOGLE_DRIVE_APK_VIEW = "https://drive.google.com/file/d/1gqT6FP81k9ATwAQRlnUeiyculcBwvW_O/view?usp=drivesdk";
const GOOGLE_DRIVE_APK_DIRECT = "https://drive.google.com/uc?export=download&id=1gqT6FP81k9ATwAQRlnUeiyculcBwvW_O";

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const refCode = (
        url.searchParams.get("ref") || 
        url.searchParams.get("code") || 
        url.searchParams.get("referral_code") || 
        url.searchParams.get("referral") || 
        ""
    ).trim();

    // Mode 1: JSON API Mode (if client requests application/json)
    if (req.headers.get("accept")?.includes("application/json")) {
        return new Response(
            JSON.stringify({
                referral_code: refCode,
                apk_view_url: GOOGLE_DRIVE_APK_VIEW,
                apk_download_url: GOOGLE_DRIVE_APK_DIRECT,
                app_deep_link: `zabardast://referral?code=${encodeURIComponent(refCode)}`
            }),
            { headers: { "content-type": "application/json" } }
        );
    }

    // Default Mode: Direct HTTP 302 Redirect to Google Drive APK View Link
    return Response.redirect(GOOGLE_DRIVE_APK_VIEW, 302);
});
