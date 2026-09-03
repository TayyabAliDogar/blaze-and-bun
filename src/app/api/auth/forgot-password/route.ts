import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/auth/http";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { clientIp } from "@/lib/auth/cookies";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendPasswordResetEmail, getSiteUrl } from "@/lib/email";

const RESET_RATE_LIMIT_MAX = 5;
const RESET_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req) ?? "unknown";
  if (await isRateLimited(`pwreset:${ip}`, RESET_RATE_LIMIT_MAX, RESET_RATE_LIMIT_WINDOW_MS)) {
    return apiError(429, "Too many reset requests. Try again in 15 minutes.", "RATE_LIMITED");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
  }
  const { email } = parsed.data;

  // Always report success regardless of whether the address exists, so the
  // endpoint can't be used to enumerate registered emails.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    try {
      const raw = await createPasswordResetToken(user.id);
      if (raw) {
        const resetUrl = `${getSiteUrl()}/reset-password?token=${encodeURIComponent(raw)}&email=${encodeURIComponent(email)}`;
        await sendPasswordResetEmail({ to: email, resetUrl });
      }
    } catch (e) {
      console.error("[auth:forgot-password]", e);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
