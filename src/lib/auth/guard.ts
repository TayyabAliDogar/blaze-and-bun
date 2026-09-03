import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashRefreshToken } from "./jwt";
import { cached } from "@/lib/cache";
import type { Role } from "@/generated/prisma/client";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  emailVerified: boolean;
}

export interface SessionUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  emailVerified: boolean;
  isActive: boolean;
}

export function toPublicUser(u: SessionUserRow): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    emailVerified: u.emailVerified,
  };
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  emailVerified: true,
  isActive: true,
} as const;

async function createSessionRow(
  sid: string,
  refreshToken: string,
  userId: string,
  ip?: string | null,
  userAgent?: string | null
): Promise<void> {
  await prisma.session.create({
    data: {
      id: sid,
      userId,
      refreshHash: await hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
    },
  });
}

/** Create a DB session row + mint tokens. Caller is responsible for setting cookies. */
export async function issueSession(
  user: SessionUserRow,
  ip?: string | null,
  userAgent?: string | null
): Promise<{ access: string; refresh: string; sid: string }> {
  const sid = crypto.randomUUID();
  const refresh = await signRefreshToken(user.id, sid);
  const access = await signAccessToken(user.id, user.role);
  await createSessionRow(sid, refresh, user.id, ip, userAgent);
  return { access, refresh, sid };
}

/** Verify an access token in isolation. Returns the public user or null. */
export async function verifyAccess(raw: string | undefined): Promise<PublicUser | null> {
  if (!raw) return null;
  const payload = await verifyAccessToken(raw);
  if (!payload) return null;
  // Short-lived user lookup cache: reduces DB hits on every authenticated call.
  // A short TTL keeps role/status revocations reasonably prompt.
  const user = await cached(
    `user:${payload.sub}`,
    () =>
      prisma.user.findUnique({
        where: { id: payload.sub },
        select: USER_SELECT,
      }),
    20 * 1000
  );
  if (!user || !user.isActive) return null;
  return toPublicUser(user);
}

/**
 * Refresh flow: verify the refresh token, confirm the DB session is live,
 * revoke the old session (rotation), and mint a fresh pair.
 */
export async function refreshSession(
  rawRefresh: string | undefined,
  ip?: string | null,
  userAgent?: string | null
): Promise<{ access: string; refresh: string; user: PublicUser } | null> {
  if (!rawRefresh) return null;
  const payload = await verifyRefreshToken(rawRefresh);
  if (!payload) return null;

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.userId !== payload.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: USER_SELECT,
  });
  if (!user || !user.isActive) return null;

  // Rotation: revoke the consumed session, create a fresh one.
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const { access, refresh } = await issueSession(user, ip, userAgent);
  return { access, refresh, user: toPublicUser(user) };
}

/** Revoke a session by its refresh token (logout). */
export async function revokeByRefresh(rawRefresh: string | undefined): Promise<void> {
  if (!rawRefresh) return;
  const payload = await verifyRefreshToken(rawRefresh);
  if (!payload) return;
  await prisma.session.updateMany({
    where: { id: payload.sid, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Best-effort current user for API gating. Prefers the access token, rotates on refresh. */
export async function resolveUser(
  accessRaw: string | undefined,
  refreshRaw: string | undefined,
  ip?: string | null,
  userAgent?: string | null
): Promise<
  | { user: PublicUser; access: string | null; refresh: string | null }
  | { user: null; access: null; refresh: null }
> {
  const fromAccess = await verifyAccess(accessRaw);
  if (fromAccess) return { user: fromAccess, access: null, refresh: null };

  if (refreshRaw) {
    const rotated = await refreshSession(refreshRaw, ip, userAgent);
    if (rotated) {
      return { user: rotated.user, access: rotated.access, refresh: rotated.refresh };
    }
  }

  return { user: null, access: null, refresh: null };
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(accessRaw: string | undefined, roles?: Role[]): Promise<PublicUser> {
  const user = await verifyAccess(accessRaw);
  if (!user) throw new AuthError(401, "Not authenticated");
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw new AuthError(403, "Insufficient permissions");
  }
  return user;
}