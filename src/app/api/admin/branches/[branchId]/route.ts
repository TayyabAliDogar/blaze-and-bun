import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";
import { invalidatePattern } from "@/lib/cache";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CURRENCIES = ["USD", "GBP", "EUR"];

/** Invalidate cached branch + menu data after a branch change. */
async function invalidateBranches() {
  await Promise.all([
    invalidatePattern("branches:"),
    invalidatePattern("menu:branch:"),
  ]);
}

interface Body {
  isActive?: unknown;
  note?: unknown;
  name?: unknown;
  address?: unknown;
  city?: unknown;
  country?: unknown;
  currencyCode?: unknown;
  phone?: unknown;
  timezone?: unknown;
  openingHours?: unknown;
  schedule?: unknown;
  deliveryRadiusKm?: unknown;
  isDefault?: unknown;
  isFeatured?: unknown;
  parking?: unknown;
  lat?: unknown;
  lng?: unknown;
}

async function requireAuth(req: NextRequest) {
  try {
    const user = await requireAdmin(req, ["admin", "staff"]);
    return { user };
  } catch (e) {
    if (e instanceof AuthError) return { error: apiError(e.status, e.message) };
    return { error: apiError(401, "Not authenticated") };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { branchId } = await params;

  try {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) return apiError(404, "Branch not found", "NOT_FOUND");

    return NextResponse.json({
      ok: true,
      branch: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        city: branch.city,
        country: branch.country,
        currencyCode: branch.currencyCode,
        phone: branch.phone,
        timezone: branch.timezone,
        openingHours: branch.openingHours,
        schedule: branch.schedule,
        deliveryRadiusKm: branch.deliveryRadiusKm,
        isDefault: branch.isDefault,
        isFeatured: branch.isFeatured,
        parking: branch.parking,
        isActive: branch.isActive,
        lat: branch.lat,
        lng: branch.lng,
        createdAt: branch.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[api:admin:branches:get]", e);
    return apiError(500, "Failed to load branch");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const { branchId } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = (raw ?? {}) as Body;
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : null;

  // Backward compatible: { isActive } alone toggles open/paused.
  const onlyToggle =
    Object.keys(b).every((k) => k === "isActive" || k === "note") &&
    b.isActive !== undefined;

  if (onlyToggle) {
    if (typeof b.isActive !== "boolean") {
      return apiError(422, "isActive (boolean) is required", "VALIDATION");
    }
    return handleToggle(req, user.id, branchId, b.isActive, note);
  }

  // Full-update path.
  const data: Prisma.BranchUpdateInput = {};

  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return apiError(422, "name cannot be empty", "VALIDATION");
    data.name = name;
  }
  if (b.address !== undefined) {
    const address = typeof b.address === "string" ? b.address.trim() : "";
    if (!address) return apiError(422, "address cannot be empty", "VALIDATION");
    data.address = address;
  }
  if (b.city !== undefined) {
    const city = typeof b.city === "string" ? b.city.trim() : "";
    if (!city) return apiError(422, "city cannot be empty", "VALIDATION");
    data.city = city;
  }
  if (b.country !== undefined) {
    const country = typeof b.country === "string" ? b.country.trim() : "";
    if (!country) return apiError(422, "country cannot be empty", "VALIDATION");
    data.country = country;
  }
  if (b.currencyCode !== undefined) {
    const cc = typeof b.currencyCode === "string" ? b.currencyCode.trim().toUpperCase() : "";
    if (!ALLOWED_CURRENCIES.includes(cc)) {
      return apiError(422, `currencyCode must be one of: ${ALLOWED_CURRENCIES.join(", ")}`, "VALIDATION");
    }
    data.currencyCode = cc;
  }
  if (b.phone !== undefined) {
    data.phone = typeof b.phone === "string" ? b.phone.trim() || null : null;
  }
  if (b.timezone !== undefined) {
    const tz = typeof b.timezone === "string" ? b.timezone.trim() : "";
    if (!tz) return apiError(422, "timezone cannot be empty", "VALIDATION");
    data.timezone = tz;
  }
  if (b.openingHours !== undefined) {
    const oh = typeof b.openingHours === "string" ? b.openingHours.trim() : "";
    if (!oh) return apiError(422, "openingHours cannot be empty", "VALIDATION");
    data.openingHours = oh;
  }
  if (b.schedule !== undefined) {
    if (b.schedule === null) {
      data.schedule = "{}" as unknown as Prisma.InputJsonValue;
    } else if (typeof b.schedule === "object" || typeof b.schedule === "string") {
      let parsed: unknown = b.schedule;
      if (typeof b.schedule === "string") {
        try {
          parsed = JSON.parse(b.schedule);
        } catch {
          return apiError(422, "schedule must be valid JSON", "VALIDATION");
        }
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return apiError(422, "schedule must be a JSON object", "VALIDATION");
      }
      data.schedule = parsed as Prisma.InputJsonValue;
    }
  }
  if (b.deliveryRadiusKm !== undefined) {
    const r = typeof b.deliveryRadiusKm === "number" ? b.deliveryRadiusKm : Number(b.deliveryRadiusKm);
    if (!Number.isFinite(r) || r <= 0) return apiError(422, "deliveryRadiusKm must be a positive number", "VALIDATION");
    data.deliveryRadiusKm = r;
  }
  if (b.isDefault !== undefined) {
    if (typeof b.isDefault !== "boolean") return apiError(422, "isDefault must be a boolean", "VALIDATION");
    data.isDefault = b.isDefault;
  }
  if (b.isFeatured !== undefined) {
    if (typeof b.isFeatured !== "boolean") return apiError(422, "isFeatured must be a boolean", "VALIDATION");
    data.isFeatured = b.isFeatured;
  }
  if (b.parking !== undefined) {
    data.parking = typeof b.parking === "string" ? b.parking.trim() || null : null;
  }
  if (b.lat !== undefined) {
    const lat = typeof b.lat === "number" ? b.lat : Number(b.lat);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return apiError(422, "lat must be between -90 and 90", "VALIDATION");
    data.lat = lat;
  }
  if (b.lng !== undefined) {
    const lng = typeof b.lng === "number" ? b.lng : Number(b.lng);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return apiError(422, "lng must be between -180 and 180", "VALIDATION");
    data.lng = lng;
  }

  if (Object.keys(data).length === 0) {
    return apiError(422, "No updatable fields provided", "VALIDATION");
  }

  try {
    const existing = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!existing) return apiError(404, "Branch not found", "NOT_FOUND");

    await prisma.branch.update({ where: { id: branchId }, data });

    await writeAudit({
      adminUserId: user.id,
      action: "BRANCH_UPDATE",
      targetTable: "Branch",
      targetId: branchId,
      ipAddress: clientIp(req),
    });

    await invalidateBranches();

    return NextResponse.json({ ok: true, branchId, updatedBy: user.id });
  } catch (e) {
    console.error("[api:admin:branches:patch]", e);
    return apiError(500, "Failed to update branch");
  }
}

async function handleToggle(
  req: NextRequest,
  adminUserId: string,
  branchId: string,
  isActive: boolean,
  note: string | null
) {
  try {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) return apiError(404, "Branch not found", "NOT_FOUND");

    if (branch.isActive && !isActive) {
      const otherActive = await prisma.branch.count({ where: { isActive: true, id: { not: branchId } } });
      if (otherActive === 0) {
        return apiError(
          409,
          "At least one branch must remain active. Pause another branch first or open a new one.",
          "LAST_ACTIVE_BRANCH"
        );
      }
    }

    await prisma.branch.update({ where: { id: branchId }, data: { isActive } });

    await writeAudit({
      adminUserId,
      action: `BRANCH_${isActive ? "OPEN" : "PAUSED"}`,
      targetTable: "Branch",
      targetId: branchId,
      ipAddress: clientIp(req),
    });

    await invalidateBranches();

    return NextResponse.json({ ok: true, branchId, isActive, note: note ?? null, updatedBy: adminUserId });
  } catch (e) {
    console.error("[api:admin:branches:toggle]", e);
    return apiError(500, "Failed to update branch");
  }
}
