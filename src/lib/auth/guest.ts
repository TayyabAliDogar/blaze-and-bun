import { SignJWT, jwtVerify } from "jose";
import { GUEST_MAX_AGE } from "./constants";

// Guest tokens are signed with a SEPARATE key from access/refresh secrets so a
// rotation or compromise of one class of token never affects the others.
const guestSecret = () => new TextEncoder().encode(
  process.env.GUEST_SECRET || process.env.REFRESH_SECRET!
);
const nowSeconds = () => Math.floor(Date.now() / 1000);

export interface GuestPayload {
  sub: string; // random guest id
  type: "guest";
}

/** Issue a temporary anonymous guest token (cookie-bound, no DB write). */
export async function signGuestToken(): Promise<string> {
  return new SignJWT({ type: "guest" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(`guest:${crypto.randomUUID()}`)
    .setIssuedAt()
    .setExpirationTime(nowSeconds() + GUEST_MAX_AGE)
    .sign(guestSecret());
}

export async function verifyGuestToken(token: string | undefined): Promise<GuestPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, guestSecret(), { algorithms: ["HS256"] });
    if (payload.type !== "guest" || !payload.sub) return null;
    return payload as unknown as GuestPayload;
  } catch {
    return null;
  }
}