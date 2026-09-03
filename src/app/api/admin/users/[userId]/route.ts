import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";
import { invalidate } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES = ["customer", "staff", "admin"] as const;

async function requireAuth(req: NextRequest) {
  try {
    return await requireAdmin(req, ["admin"]);
  } catch (e) {
    if (e instanceof AuthError) return { error: apiError(e.status, e.message) };
    return { error: apiError(401, "Not authenticated") };
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const actor = auth;

  const { userId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = raw as { role?: unknown; isActive?: unknown };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return apiError(404, "User not found", "NOT_FOUND");

  // Self-protection: an admin may not demote or deactivate their own account,
  // otherwise they could lock themselves out of the admin console.
  if (userId === actor.id) {
    const changingSelf =
      (b.role !== undefined && b.role !== target.role) ||
      (b.isActive !== undefined && b.isActive !== target.isActive && !b.isActive);
    if (changingSelf && b.isActive !== true) {
      return apiError(409, "You cannot demote or deactivate your own account.", "SELF_MODIFY");
    }
  }

  const changes: { role?: (typeof VALID_ROLES)[number]; isActive?: boolean } = {};

  if (b.role !== undefined) {
    if (!VALID_ROLES.includes(b.role as (typeof VALID_ROLES)[number])) {
      return apiError(422, "role must be one of: customer, staff, admin", "VALIDATION");
    }
    changes.role = b.role as (typeof VALID_ROLES)[number];
  }

  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") {
      return apiError(422, "isActive must be a boolean", "VALIDATION");
    }
    changes.isActive = b.isActive;
  }

  if (Object.keys(changes).length === 0) {
    return apiError(422, "No updatable fields provided", "VALIDATION");
  }

  // Guard: never leave the system without an ACTIVE admin.
  const isDemotingAdmin = target.role === "admin" && changes.role && changes.role !== "admin";
  const isDeactivatingAdmin = target.role === "admin" && changes.isActive === false;
  if (isDemotingAdmin || isDeactivatingAdmin) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "admin", isActive: true, id: { not: userId } },
    });
    if (otherActiveAdmins === 0) {
      return apiError(
        409,
        "At least one active admin must remain. Promote or reactivate another admin first.",
        "LAST_ADMIN"
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: changes,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    const action =
      changes.role && changes.role !== target.role
        ? `USER_ROLE_${changes.role.toUpperCase()}`
        : changes.isActive === false
          ? "USER_DEACTIVATE"
          : changes.isActive === true
            ? "USER_ACTIVATE"
            : "USER_UPDATE";

    await writeAudit({
      adminUserId: actor.id,
      action,
      targetTable: "User",
      targetId: userId,
      ipAddress: clientIp(req),
    });

    await invalidate(`user:${userId}`);

    return NextResponse.json({ ok: true, user: updated, actorId: actor.id });
  } catch (e) {
    console.error("[api:admin:users:patch]", e);
    return apiError(500, "Failed to update user");
  }
}
