import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const enc = (s: string) => new TextEncoder().encode(s);
const accessSecret = () => enc(process.env.SESSION_SECRET!);
const refreshSecret = () => enc(process.env.REFRESH_SECRET!);

export interface AccessPayload extends JWTPayload {
  sub: string; // userId
  role: string;
  type: "access";
}

export interface RefreshPayload extends JWTPayload {
  sub: string; // userId
  sid: string; // Session.id
  jti: string; // random token id
  type: "refresh";
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function signAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(nowSeconds() + 15 * 60)
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.type !== "access" || !payload.sub) return null;
    return payload as unknown as AccessPayload;
  } catch {
    return null;
  }
}

export async function signRefreshToken(userId: string, sid: string): Promise<string> {
  return new SignJWT({ type: "refresh", sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(nowSeconds() + 7 * 24 * 60 * 60)
    .sign(refreshSecret());
}

export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.type !== "refresh" || !payload.sub || !payload.sid) return null;
    return payload as unknown as RefreshPayload;
  } catch {
    return null;
  }
}

/** Deterministic fingerprint of a refresh token — stored in DB for rotation/revocation. */
export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}