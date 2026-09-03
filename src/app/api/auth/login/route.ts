import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/auth/validation";
import { issueSession, toPublicUser } from "@/lib/auth/guard";
import { setAuthCookies, clientIp } from "@/lib/auth/cookies";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/auth/rate-limit";
import { LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS } from "@/lib/auth/constants";
import { apiError } from "@/lib/auth/http";
import { linkGuestOrdersByEmail } from "@/lib/orders/link";

export async function POST(req: NextRequest) {
  const ip = clientIp(req) ?? "unknown";

  // Brute-force protection: max 5 failed attempts / 15 min / IP.
  if (await isRateLimited(`login:${ip}`, LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS)) {
    return apiError(
      429,
      "Too many login attempts. Try again in 15 minutes.",
      "RATE_LIMITED"
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emailVerified: true,
        isActive: true,
        hashedPassword: true,
      },
    });

    const valid = user && (await verifyPassword(password, user.hashedPassword));
    if (!user || !valid) {
      await recordFailure(`login:${ip}`);
      return apiError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    if (!user.isActive) {
      return apiError(403, "This account has been disabled.", "ACCOUNT_DISABLED");
    }

    await clearFailures(`login:${ip}`);

    const { access, refresh } = await issueSession(user, ip, req.headers.get("user-agent"));

    await linkGuestOrdersByEmail(user.id, user.email);

    const res = NextResponse.json({ ok: true, user: toPublicUser(user) });
    return setAuthCookies(res, access, refresh);
  } catch (e) {
    console.error("[auth:login]", e);
    return apiError(500, "Something went wrong. Please try again.");
  }
}