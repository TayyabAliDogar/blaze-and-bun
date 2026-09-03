import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth/http";
import { resolveOrderContext, buildServerCart, type CartLineDTO } from "@/lib/orders/cart";
import { computeEta, kitchenLoad } from "@/lib/orders/eta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const b = (body ?? {}) as {
    items?: unknown;
    deliveryType?: unknown;
    deliveryLat?: unknown;
    deliveryLng?: unknown;
  };
  if (!Array.isArray(b.items)) return apiError(422, "items must be an array", "VALIDATION");

  try {
    const ctx = await resolveOrderContext(req);
    const lines = b.items.filter((x): x is CartLineDTO => Boolean(x && typeof x === "object"));
    const cart = await buildServerCart(lines, ctx.branch);

    const deliveryType = b.deliveryType === "pickup" ? "pickup" : "delivery";
    const deliveryLat =
      typeof b.deliveryLat === "number" && Number.isFinite(b.deliveryLat) ? b.deliveryLat : null;
    const deliveryLng =
      typeof b.deliveryLng === "number" && Number.isFinite(b.deliveryLng) ? b.deliveryLng : null;
    const preparingCount = await kitchenLoad(ctx.branch.id);
    const eta = computeEta({
      deliveryType,
      branchLat: ctx.branch.lat,
      branchLng: ctx.branch.lng,
      deliveryLat,
      deliveryLng,
      preparingCount,
      radiusKm: ctx.branch.deliveryRadiusKm ?? null,
    });

    return NextResponse.json({
      ok: true,
      branch: {
        id: ctx.branch.id,
        name: ctx.branch.name,
        city: ctx.branch.city,
        currencyCode: ctx.currencyCode,
        isOpen: ctx.isOpen,
      },
      currencyCode: ctx.currencyCode,
      eta,
      kitchenLoad: preparingCount,
      itemsValidated: cart.lines.length,
      itemsInvalid: lines.length - cart.lines.length,
      items: cart.lines.map((l) => ({
        lineId: l.lineId,
        menuItemId: l.menuItemId,
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        customizationSnapshot: l.customizationSnapshot,
      })),
      totals: {
        subtotal: cart.subtotal,
        deliveryFee: cart.deliveryFee,
        tax: cart.tax,
        total: cart.total,
      },
    });
  } catch (e) {
    console.error("[api:cart:validate]", e);
    return apiError(500, "Failed to validate cart");
  }
}
