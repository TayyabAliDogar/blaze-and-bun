import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/constants";
import { verifyAccessToken } from "@/lib/auth/jwt";

// ---------------------------------------------------------------------------
// Guest order access (Phase 6.5 hardening).
//
// Guest orders carry a one-time, random lookup token. Only the SHA-256 hash is
// persisted (`Order.guestAccessTokenHash`); the raw token is shown once at
// checkout. Signed-in users own their orders directly via `Order.userId`.
// ---------------------------------------------------------------------------

export const CANCELLATION_WINDOW_MS = 120 * 1000; // 120 seconds
export const CANCELLABLE_STATUSES = new Set(["pending", "received"] as const);

export function generateGuestAccessToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  return { raw, hash: hashAccessToken(raw) };
}

/** Deterministic SHA-256 hex digest — stored value, never the raw token. */
export function hashAccessToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Constant-time comparison so token guesses can't be timed. */
export function tokensMatch(raw: string | null | undefined, storedHash: string | null | undefined): boolean {
  if (!raw || !storedHash) return false;
  const a = Buffer.from(hashAccessToken(raw), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type OrderAccess = { kind: "user"; userId: string } | { kind: "guest"; email: string } | null;

/**
 * Resolve who is asking for an order.
 *  - A valid access cookie yields the signed-in user id.
 *  - Otherwise `email` (must match Order.guestEmail) + `token` (must match
 *    Order.guestAccessTokenHash) are required for guest lookups/cancels.
 */
export async function resolveOrderAccess(
  req: NextRequest,
  input: { token?: string | null; email?: string | null }
): Promise<OrderAccess> {
  const accessRaw = req.cookies.get(ACCESS_COOKIE)?.value;
  if (accessRaw) {
    const payload = await verifyAccessToken(accessRaw);
    if (payload?.sub) return { kind: "user", userId: payload.sub };
  }

  const email = (input.email ?? "").trim().toLowerCase();
  if (!email) return null;
  if (!input.token) return null;

  // Presence of a token alone isn't trustworthy — the route still compares it
  // against the stored hash for the specific order. Return email for the match.
  return { kind: "guest", email };
}

/** True when the resolver output may access an order owned by `userId`/`guestEmail`. */
export function canAccessOrder(
  access: OrderAccess,
  order: { userId: string | null; guestEmail: string | null }
): boolean {
  if (!access) return false;
  if (access.kind === "user") return order.userId === access.userId;
  if (access.kind === "guest") {
    const match = order.guestEmail === access.email;
    return match;
  }
  return false;
}