import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Password reset tokens (Phase: transactional email).
//
// A random, one-time token is generated; only its SHA-256 hash is persisted in
// PasswordResetToken along with an expiry. The raw token appears only in the
// emailed reset link, so a DB leak can't be replayed to reset passwords.
// ---------------------------------------------------------------------------

export const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function tokensEqual(raw: string, storedHash: string): boolean {
  const a = Buffer.from(hashResetToken(raw), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Create a reset token for a user, invalidating any previously issued tokens
 * for that user. Returns the raw token (email-link-only) or null.
 */
export async function createPasswordResetToken(
  userId: string
): Promise<string | null> {
  const { raw, hash } = generateResetToken();
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  return raw;
}

/** Resolve + consume a valid reset token to its user; null on any failure. */
export async function consumePasswordResetToken(
  rawToken: string
): Promise<{ userId: string; tokenId: string } | null> {
  const hash = hashResetToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
  });
  if (!record) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt < new Date()) return null;
  if (!tokensEqual(rawToken, record.tokenHash)) return null;

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return { userId: record.userId, tokenId: record.id };
}
