import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, ["admin", "staff"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  const scope = req.nextUrl.searchParams.get("scope")?.trim();

  try {
    const promos = await prisma.promoCode.findMany({
      where: scope === "all" ? {} : { isActive: true },
      include: { branch: { select: { id: true, name: true, city: true } } },
      orderBy: { createdAt: "desc" },
    });

    const now = Date.now();

    return NextResponse.json({
      ok: true,
      promos: promos.map((p) => {
        const expiry = p.expiresAt ? new Date(p.expiresAt).getTime() : null;
        const isExpired = expiry !== null ? expiry < now : false;
        const startsInFuture = p.startsAt ? new Date(p.startsAt).getTime() > now : false;
        const usageLimit = p.usageLimit ?? null;
        const pct =
          usageLimit !== null && usageLimit > 0
            ? Math.min(100, Math.round((p.usedCount / usageLimit) * 100))
            : null;
        return {
          id: p.id,
          code: p.code,
          description: p.description,
          discountType: p.discountType,
          discountValue: Number(p.discountValue),
          maxDiscount: p.maxDiscount !== null ? Number(p.maxDiscount) : null,
          minOrderAmount: Number(p.minOrderAmount),
          branchId: p.branchId,
          branch: p.branch ? { id: p.branch.id, name: p.branch.name, city: p.branch.city } : null,
          startsAt: p.startsAt ? p.startsAt.toISOString() : null,
          expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
          usageLimit,
          usedCount: p.usedCount,
          isActive: p.isActive,
          isExpired,
          startsInFuture,
          usagePercent: pct,
          createdAt: p.createdAt.toISOString(),
        };
      }),
    });
  } catch (e) {
    console.error("[api:admin:promos:list]", e);
    return apiError(500, "Failed to load promo codes");
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAdmin(req, ["admin"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = (raw ?? {}) as {
    code?: unknown;
    description?: unknown;
    discountType?: unknown;
    discountValue?: unknown;
    maxDiscount?: unknown;
    minOrderAmount?: unknown;
    branchId?: unknown;
    startsAt?: unknown;
    expiresAt?: unknown;
    usageLimit?: unknown;
  };

  const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
  if (!code) return apiError(422, "code is required", "VALIDATION");
  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (!description) return apiError(422, "description is required", "VALIDATION");

  if (b.discountType !== "percent" && b.discountType !== "fixed") {
    return apiError(422, "discountType must be 'percent' or 'fixed'", "VALIDATION");
  }
  const discountType = b.discountType as "percent" | "fixed";
  const discountValue = typeof b.discountValue === "number" ? b.discountValue : Number(b.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return apiError(422, "discountValue must be a positive number", "VALIDATION");
  }
  if (discountType === "percent" && discountValue > 100) {
    return apiError(422, "Percent discount cannot exceed 100", "VALIDATION");
  }

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  };
  const maxDiscount = num(b.maxDiscount);
  const minOrderAmount = num(b.minOrderAmount);
  const usageLimit =
    b.usageLimit === null || b.usageLimit === undefined || b.usageLimit === ""
      ? null
      : (() => {
          const n = Number(b.usageLimit);
          return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
        })();

  const date = (v: unknown): Date | null => {
    if (typeof v !== "string" || !v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const startsAt = date(b.startsAt);
  const expiresAt = date(b.expiresAt);
  if (startsAt && expiresAt && startsAt.getTime() >= expiresAt.getTime()) {
    return apiError(422, "expiresAt must be after startsAt", "VALIDATION");
  }

  let branchId: string | null = null;
  if (b.branchId !== undefined && b.branchId !== null && b.branchId !== "") {
    branchId = typeof b.branchId === "string" ? b.branchId : null;
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) return apiError(404, "Branch not found", "NOT_FOUND");
    }
  }

  try {
    const existing = await prisma.promoCode.findUnique({ where: { code } });
    if (existing) return apiError(409, "A promo code with this code already exists", "CODE_TAKEN");

    const promo = await prisma.promoCode.create({
      data: {
        code,
        description,
        discountType,
        discountValue: new Prisma.Decimal(discountValue),
        maxDiscount: maxDiscount !== null ? new Prisma.Decimal(maxDiscount) : null,
        minOrderAmount: new Prisma.Decimal(minOrderAmount ?? 0),
        branchId,
        startsAt,
        expiresAt,
        usageLimit,
        isActive: true,
      },
    });

    await writeAudit({
      adminUserId: user.id,
      action: "PROMO_CREATE",
      targetTable: "PromoCode",
      targetId: promo.id,
      ipAddress: clientIp(req),
    });

    return NextResponse.json(
      { ok: true, promo: { id: promo.id, code: promo.code } },
      { status: 201 }
    );
  } catch (e) {
    console.error("[api:admin:promos:create]", e);
    return apiError(500, "Failed to create promo code");
  }
}
