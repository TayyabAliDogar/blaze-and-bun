import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueSession } from "@/lib/auth/guard";
import { setAuthCookies } from "@/lib/auth/cookies";
import { clientIp } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  email_verified?: boolean;
}

/**
 * GET /api/auth/google/callback — Handle the Google OAuth callback.
 *
 * 1. Exchange the authorization `code` for an access token.
 * 2. Fetch the user's profile (name, email) from Google.
 * 3. Upsert the user in our database (linked by email).
 * 4. Issue a Blaze & Bun session (access + refresh cookies).
 * 5. Redirect the user back to the originating page.
 *
 * All failures redirect to `/?auth=google_error=<reason>` so nothing dead-ends.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const stateParam = sp.get("state") || "";
  const origin = (() => {
    try { return decodeURIComponent(stateParam); } catch { return REDIRECT_BASE; }
  })();

  if (!code) {
    return NextResponse.redirect(`${REDIRECT_BASE}/?auth=google_error=no_code`);
  }

  // No Google credentials — surface a clear error instead of a demo session.
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${REDIRECT_BASE}/login?auth_error=google_not_configured`);
  }

  try {
    // 1. Exchange code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${REDIRECT_BASE}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData: GoogleTokenResponse = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[auth:google:callback] token exchange failed:", tokenData.error ?? tokenRes.status);
      return NextResponse.redirect(`${REDIRECT_BASE}/?auth=google_error=token_exchange_failed`);
    }

    // 2. Fetch user profile from Google.
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile: GoogleUserInfo = await profileRes.json();

    if (!profileRes.ok || !profile.email) {
      console.error("[auth:google:callback] userinfo failed:", profileRes.status, profile);
      return NextResponse.redirect(`${REDIRECT_BASE}/?auth=google_error=profile_fetch_failed`);
    }

    const email = profile.email.trim().toLowerCase();
    const name = profile.name?.trim() || email.split("@")[0];

    // 3. Upsert: find existing user by email, or create a new customer.
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, phone: true, role: true, isActive: true, emailVerified: true },
    });

    // A deactivated account may not be re-signed-in via Google.
    if (existing && !existing.isActive) {
      return NextResponse.redirect(`${REDIRECT_BASE}/login?auth_error=account_disabled`);
    }

    const sessionUser = existing
      ? // Link the Google account to the existing user, preserving their role.
        {
          id: existing.id,
          name: existing.name,
          email,
          phone: existing.phone,
          role: existing.role as "customer" | "staff" | "admin",
          emailVerified: existing.emailVerified,
          isActive: true,
        }
      : // Create a lightweight customer row (no password — OAuth-only).
        await (async () => {
          const newUser = await prisma.user.create({
            data: {
              name,
              email,
              hashedPassword: "",   // OAuth accounts have no local password.
              role: "customer",
              emailVerified: Boolean(profile.email_verified),
              isActive: true,
            },
            select: { id: true, role: true },
          });
          return {
            id: newUser.id,
            name,
            email,
            phone: null,
            role: newUser.role as "customer" | "staff" | "admin",
            emailVerified: Boolean(profile.email_verified),
            isActive: true,
          };
        })();

    // 4. Issue a Blaze & Bun session (same as email/password login).
    const ip = clientIp(req);
    const userAgent = req.headers.get("user-agent");
    const { access, refresh } = await issueSession(
      sessionUser,
      ip,
      userAgent
    );

    const redirectUrl = origin.startsWith(REDIRECT_BASE) ? origin : REDIRECT_BASE;
    const res = NextResponse.redirect(redirectUrl);
    return setAuthCookies(res, access, refresh);
  } catch (e) {
    console.error("[auth:google:callback]", e);
    return NextResponse.redirect(`${REDIRECT_BASE}/?auth=google_error=internal`);
  }
}