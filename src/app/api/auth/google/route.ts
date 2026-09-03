import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google
 * Real Google OAuth 2.0 authorization-code flow. Redirects the user to
 * Google's consent screen. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
 * When credentials are missing, redirects to a clear error (never a demo user).
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectBase = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const referer = req.headers.get("referer") || "/";

  // No Google credentials configured — surface a clear error instead of
  // silently signing the visitor into a shared/demo account.
  if (!clientId || !clientSecret) {
    const errUrl = new URL("/login", redirectBase);
    errUrl.searchParams.set("auth_error", "google_not_configured");
    return NextResponse.redirect(errUrl);
  }

  // ── Real Google OAuth flow ───────────────────────────────────────────────
  const callbackUrl = `${redirectBase}/api/auth/google/callback`;
  const state = encodeURIComponent(referer);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });

  return NextResponse.redirect(
    new URL(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`),
  );
}