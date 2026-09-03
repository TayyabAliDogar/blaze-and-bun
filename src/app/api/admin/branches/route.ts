import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/admin/guard";
import { currencySymbol } from "@/lib/location/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, ["admin", "staff"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  try {
    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        city: b.city,
        country: b.country,
        currencyCode: b.currencyCode,
        currencySymbol: currencySymbol(b.currencyCode),
        phone: b.phone,
        timezone: b.timezone,
        openingHours: b.openingHours,
        schedule: b.schedule,
        deliveryRadiusKm: b.deliveryRadiusKm,
        isDefault: b.isDefault,
        isFeatured: b.isFeatured,
        parking: b.parking,
        isActive: b.isActive,
        lat: b.lat,
        lng: b.lng,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[api:admin:branches:list]", e);
    return apiError(500, "Failed to load branches");
  }
}
