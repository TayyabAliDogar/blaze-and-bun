import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { AuthError } from "@/lib/auth/guard";
import type { Role } from "@/generated/prisma/client";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Node-runtime RBAC guard for /api/admin/* routes. Requires ADMIN or STAFF.
 * Re-verifies the JWT and confirms a live, active user row (defense in depth).
 */
export async function requireAdmin(
  req: NextRequest,
  roles: Role[] = ["admin", "staff"]
): Promise<AdminUser> {
  const access = req.cookies.get("blaze_access")?.value;
  if (!access) {
    throw new AuthError(401, "Not authenticated");
  }
  const payload = await verifyAccessToken(access);
  if (!payload || !payload.sub) {
    throw new AuthError(401, "Not authenticated");
  }
  if (!roles.includes(payload.role as Role)) {
    throw new AuthError(403, "You don't have permission to do that.");
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new AuthError(401, "Not authenticated");
  }
  if (!roles.includes(user.role)) {
    throw new AuthError(403, "You don't have permission to do that.");
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Write a row to AdminAuditLog for a manual admin/staff action. */
export async function writeAudit(input: {
  adminUserId: string;
  action: string;
  targetTable: string;
  targetId?: string;
  ipAddress?: string | null;
}): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      targetTable: input.targetTable,
      targetId: input.targetId ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

export function clientIp(req: NextRequest): string | null {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  }
  return null;
}
