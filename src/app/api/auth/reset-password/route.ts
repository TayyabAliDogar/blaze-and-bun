import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/auth/http";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { clearAuthCookies, clientIp } from "@/lib/auth/cookies";
import { isRateLimited } from "@/lib/auth/rate-limit";

const RESET_PW_RATE_LIMIT_MAX = 10;
const RESET_PW_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req) ?? "unknown";
  if (await isRateLimited(`pwset:${ip}`, RESET_PW_RATE_LIMIT_MAX, RESET_PW_RATE_LIMIT_WINDOW_MS)) {
    return apiError(429, "Too many attempts. Try again in 15 minutes.", "RATE_LIMITED");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
  }
  const { token, password } = parsed.data;

  const consumed = await consumePasswordResetToken(token);
  if (!consumed) {
    return apiError(400, "This reset link is invalid or has expired.", "INVALID_TOKEN");
  }

  const user = await prisma.user.findUnique({
    where: { id: consumed.userId },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return apiError(400, "This reset link is invalid or has expired.", "INVALID_TOKEN");
  }

  const hashedPassword = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword },
    }),
    // Revoke every active session so the old password can't be used anywhere.
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  const res = NextResponse.json({ ok: true });
  return clearAuthCookies(res);
}
