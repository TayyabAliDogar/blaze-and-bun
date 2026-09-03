import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signupSchema } from "@/lib/auth/validation";
import { issueSession, toPublicUser } from "@/lib/auth/guard";
import { setAuthCookies, clientIp } from "@/lib/auth/cookies";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { apiError } from "@/lib/auth/http";
import { linkGuestOrdersByEmail } from "@/lib/orders/link";

const SIGNUP_RATE_LIMIT_MAX = 10;
const SIGNUP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req) ?? "unknown";
  if (await isRateLimited(`signup:${ip}`, SIGNUP_RATE_LIMIT_MAX, SIGNUP_RATE_LIMIT_WINDOW_MS)) {
    return apiError(429, "Too many sign-up attempts. Try again in 15 minutes.", "RATE_LIMITED");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
  }

  const { name, email, phone, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return apiError(409, "An account with this email already exists", "EMAIL_TAKEN");
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        hashedPassword,
        role: "customer",
        emailVerified: false,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emailVerified: true,
        isActive: true,
      },
    });

    const { access, refresh } = await issueSession(user, clientIp(req), req.headers.get("user-agent"));

    await linkGuestOrdersByEmail(user.id, user.email);

    const res = NextResponse.json({ ok: true, user: toPublicUser(user) }, { status: 201 });
    return setAuthCookies(res, access, refresh);
  } catch (e) {
    console.error("[auth:signup]", e);
    return apiError(500, "Something went wrong. Please try again.");
  }
}