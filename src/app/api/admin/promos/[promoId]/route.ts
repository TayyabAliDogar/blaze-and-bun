import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuth(req: NextRequest, roles: ("admin" | "staff")[] = ["admin"]) {
  try {
    return await requireAdmin(req, roles);
  } catch (e) {
    if (e instanceof AuthError) return { error: apiError(e.status, e.message) };
    return { error: apiError(401, "Not authenticated") };
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ promoId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  const { promoId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = raw as Record<string, unknown>;

  const existing = await prisma.promoCode.findUnique({ where: { id: promoId } });
  if (!existing) return apiError(404, "Promo code not found", "NOT_FOUND");

  const data: Prisma.PromoCodeUpdateInput = {};

  if (b.description !== undefined) {
    const description = typeof b.description === "string" ? b.description.trim() : "";
    if (!description) return apiError(422, "description cannot be empty", "VALIDATION");
    data.description = description;
  }
  if (b.discountType !== undefined) {
    if (b.discountType !== "percent" && b.discountType !== "fixed") {
      return apiError(422, "discountType must be 'percent' or 'fixed'", "VALIDATION");
    }
    data.discountType = b.discountType as "percent" | "fixed";
  }
  if (b.discountValue !== undefined) {
    const discountValue = typeof b.discountValue === "number" ? b.discountValue : Number(b.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return apiError(422, "discountValue must be a positive number", "VALIDATION");
    }
    const type = (b.discountType as string) ?? existing.discountType;
    if (type === "percent" && discountValue > 100) {
      return apiError(422, "Percent discount cannot exceed 100", "VALIDATION");
    }
    data.discountValue = new Prisma.Decimal(discountValue);
  }
  if (b.maxDiscount !== undefined) {
    if (b.maxDiscount === null || b.maxDiscount === "") {
      data.maxDiscount = null;
    } else {
      const n = typeof b.maxDiscount === "number" ? b.maxDiscount : Number(b.maxDiscount);
      if (!Number.isFinite(n) || n < 0) return apiError(422, "maxDiscount must be a non-negative number", "VALIDATION");
      data.maxDiscount = new Prisma.Decimal(n);
    }
  }
  if (b.minOrderAmount !== undefined) {
    const v = b.minOrderAmount === "" ? 0 : Number(b.minOrderAmount);
    if (!Number.isFinite(v) || v < 0) return apiError(422, "minOrderAmount must be a non-negative number", "VALIDATION");
    data.minOrderAmount = new Prisma.Decimal(v);
  }
  if (b.usageLimit !== undefined) {
    if (b.usageLimit === null || b.usageLimit === "") {
      data.usageLimit = null;
    } else {
      const n = Number(b.usageLimit);
      if (!Number.isFinite(n) || n < 0) return apiError(422, "usageLimit must be a non-negative integer", "VALIDATION");
      data.usageLimit = Math.floor(n);
    }
  }
  if (b.startsAt !== undefined) {
    if (b.startsAt === null || b.startsAt === "") {
      data.startsAt = null;
    } else {
      const d = new Date(b.startsAt as string);
      if (Number.isNaN(d.getTime())) return apiError(422, "startsAt is an invalid date", "VALIDATION");
      data.startsAt = d;
    }
  }
  if (b.expiresAt !== undefined) {
    if (b.expiresAt === null || b.expiresAt === "") {
      data.expiresAt = null;
    } else {
      const d = new Date(b.expiresAt as string);
      if (Number.isNaN(d.getTime())) return apiError(422, "expiresAt is an invalid date", "VALIDATION");
      data.expiresAt = d;
    }
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") return apiError(422, "isActive must be a boolean", "VALIDATION");
    data.isActive = b.isActive;
  }
  if (b.branchId !== undefined) {
    if (b.branchId === null || b.branchId === "") {
      data.branch = { disconnect: true };
    } else if (typeof b.branchId === "string") {
      const branch = await prisma.branch.findUnique({ where: { id: b.branchId } });
      if (!branch) return apiError(404, "Branch not found", "NOT_FOUND");
      data.branch = { connect: { id: b.branchId } };
    } else {
      return apiError(422, "branchId must be a string or null", "VALIDATION");
    }
  }
  if (b.code !== undefined) {
    const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
    if (!code) return apiError(422, "code cannot be empty", "VALIDATION");
    const dup = await prisma.promoCode.findFirst({ where: { code, id: { not: promoId } } });
    if (dup) return apiError(409, "A promo code with this code already exists", "CODE_TAKEN");
    data.code = code;
  }

  if (Object.keys(data).length === 0) {
    return apiError(422, "No updatable fields provided", "VALIDATION");
  }

  try {
    await prisma.promoCode.update({ where: { id: promoId }, data });

    await writeAudit({
      adminUserId: user.id,
      action: "PROMO_UPDATE",
      targetTable: "PromoCode",
      targetId: promoId,
      ipAddress: clientIp(req),
    });

    return NextResponse.json({ ok: true, promoId, updatedBy: user.id });
  } catch (e) {
    console.error("[api:admin:promos:patch]", e);
    return apiError(500, "Failed to update promo code");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ promoId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  const { promoId } = await params;

  try {
    const existing = await prisma.promoCode.findUnique({ where: { id: promoId } });
    if (!existing) return apiError(404, "Promo code not found", "NOT_FOUND");

    // Soft-deactivate — keep historical redemptions/orders intact.
    await prisma.promoCode.update({
      where: { id: promoId },
      data: { isActive: false },
    });

    await writeAudit({
      adminUserId: user.id,
      action: "PROMO_DEACTIVATE",
      targetTable: "PromoCode",
      targetId: promoId,
      ipAddress: clientIp(req),
    });

    return NextResponse.json({ ok: true, promoId, deactivated: true });
  } catch (e) {
    console.error("[api:admin:promos:delete]", e);
    return apiError(500, "Failed to deactivate promo code");
  }
}
