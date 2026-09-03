import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth/http";
import {
  resolveOrderContext,
  buildServerCart,
  findPromo,
  promoDiscount,
  type CartLineDTO,
} from "@/lib/orders/cart";
import { computeTotalsCore } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PromoBody {
  code?: string;
  items?: unknown;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const { code, items } = body as PromoBody;
  if (typeof code !== "string" || !code.trim()) {
    return apiError(422, "code is required", "VALIDATION");
  }
  if (!Array.isArray(items)) return apiError(422, "items must be an array", "VALIDATION");

  try {
    const ctx = await resolveOrderContext(req);

    const promo = await findPromo(code, ctx.branch.id);
    if (!promo) {
      return NextResponse.json(
        {
          ok: false,
          code: "PROMO_INVALID",
          message: "That promo code isn't valid for this order.",
          valid: false,
        },
        { status: 400 }
      );
    }

    const lines = items.filter((x): x is CartLineDTO => Boolean(x && typeof x === "object"));
    const cart = await buildServerCart(lines, ctx.branch);
    const currency = ctx.currencyCode === "GBP" ? "GBP" : "USD";

    if (Number(cart.subtotal) < Number(promo.minOrderAmount)) {
      return NextResponse.json(
        {
          ok: false,
          code: "MIN_ORDER",
          message: `Not yet — this code needs a $${Number(promo.minOrderAmount)} subtotal.`,
          valid: false,
          minOrderAmount: Number(promo.minOrderAmount),
          subtotal: cart.subtotal,
        },
        { status: 400 }
      );
    }

    const { discountUsd } = promoDiscount(promo, cart.subtotal);
    const totals = computeTotalsCore(cart.subtotal, currency, discountUsd);

    return NextResponse.json({
      ok: true,
      valid: true,
      promo: {
        code: promo.code,
        description: promo.description,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue),
        maxDiscount: promo.maxDiscount !== null ? Number(promo.maxDiscount) : null,
      },
      discountUsd,
      totals: {
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        tax: totals.tax,
        discount: discountUsd,
        total: totals.total,
      },
    });
  } catch (e) {
    console.error("[api:promo:validate]", e);
    return apiError(500, "Failed to validate promo");
  }
}
