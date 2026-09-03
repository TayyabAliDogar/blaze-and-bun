import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/auth/http";
import { ACCESS_COOKIE } from "@/lib/auth/constants";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { GUEST_COOKIE } from "@/lib/auth/constants";
import {
  resolveOrderContext,
  buildServerCart,
  findPromo,
  promoDiscount,
  statusLogData,
  clampUsd,
  type CartLineDTO,
} from "@/lib/orders/cart";
import { computeTotalsCore } from "@/lib/money";
import { computeEta, kitchenLoad } from "@/lib/orders/eta";
import { generateGuestAccessToken } from "@/lib/orders/access";
import { sendOrderConfirmation } from "@/lib/email";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import type { PaymentMethod, DeliveryType, Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckoutBody {
  items?: unknown;
  deliveryType?: unknown;
  paymentMethod?: unknown;
  promoCode?: unknown;
  guestName?: unknown;
  guestEmail?: unknown;
  guestPhone?: unknown;
  deliveryAddress?: unknown;
  deliveryNotes?: unknown;
  deliveryLat?: unknown;
  deliveryLng?: unknown;
}

// Only `card` and `cod` are enabled. Wallet providers (Google/Apple Pay) are
// not yet integrated, so they are rejected at the API boundary too.
const PAYMENT_METHODS: PaymentMethod[] = ["card", "cod"];
const DELIVERY_TYPES: DeliveryType[] = ["delivery", "pickup"];

/** Stub payment gateway: mint a pseudo payment-intent id (demo mode only). */
function stubIntent(method: PaymentMethod, totalCents: number, orderId: string): string {
  if (method === "cod") return `cod_${orderId.replace(/[^a-zA-Z0-9]/g, "")}`;
  return `pi_stub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const b = (body ?? {}) as CheckoutBody;
  if (!Array.isArray(b.items) || b.items.length === 0) {
    return apiError(422, "items must be a non-empty array", "VALIDATION");
  }

  const deliveryType: DeliveryType =
    b.deliveryType && DELIVERY_TYPES.includes(b.deliveryType as DeliveryType)
      ? (b.deliveryType as DeliveryType)
      : "delivery";
  const paymentMethod =
    b.paymentMethod && PAYMENT_METHODS.includes(b.paymentMethod as PaymentMethod)
      ? (b.paymentMethod as PaymentMethod)
      : null;
  if (!paymentMethod) return apiError(422, "paymentMethod is required", "VALIDATION");

  const guestEmail = typeof b.guestEmail === "string" ? b.guestEmail.trim().toLowerCase() : "";
  const guestName = typeof b.guestName === "string" ? b.guestName.trim().slice(0, 120) : "";
  const guestPhone = typeof b.guestPhone === "string" ? b.guestPhone.trim().slice(0, 40) : "";
  const deliveryAddress = typeof b.deliveryAddress === "string" ? b.deliveryAddress.trim().slice(0, 300) : "";
  const deliveryNotes = typeof b.deliveryNotes === "string" ? b.deliveryNotes.trim().slice(0, 500) : "";
  const deliveryLat =
    typeof b.deliveryLat === "number" && Number.isFinite(b.deliveryLat) ? b.deliveryLat : null;
  const deliveryLng =
    typeof b.deliveryLng === "number" && Number.isFinite(b.deliveryLng) ? b.deliveryLng : null;

  if (deliveryType === "delivery" && !deliveryAddress) {
    return apiError(422, "deliveryAddress is required for delivery", "VALIDATION");
  }
  if (!paymentMethod || paymentMethod !== "cod" && !guestName) {
    // For card/gateway orders we still require a recipient name for the stub.
    if (!guestName && !b.guestEmail) {
      return apiError(422, "Recipient details are required", "VALIDATION");
    }
  }

  try {
    const ctx = await resolveOrderContext(req);
    if (!ctx.isOpen) {
      return apiError(409, "This branch is currently closed. Please check back during opening hours.", "BRANCH_CLOSED");
    }

    // Identify authenticated user via the access cookie.
    let userId: string | null = null;
    const accessRaw = req.cookies.get(ACCESS_COOKIE)?.value;
    if (accessRaw) {
      const payload = await verifyAccessToken(accessRaw);
      if (payload) userId = payload.sub;
    }
    const guestCookie = req.cookies.get(GUEST_COOKIE)?.value ?? null;
    const guestId = guestCookie ? guestCookie.split("guest:")[1] ?? guestCookie : guestCookie;

    // Build (and trust nothing from) the client cart — server re-prices everything.
    const lines = b.items.filter((x): x is CartLineDTO => Boolean(x && typeof x === "object"));
    const cart = await buildServerCart(lines, ctx.branch);
    if (cart.lines.length === 0) {
      return apiError(422, "No valid items in cart", "VALIDATION");
    }

    const currency = ctx.currencyCode === "GBP" ? "GBP" : "USD";

    // Resolve promo (if provided) and compute discount.
    let promoId: string | null = null;
    let promoDiscountUsd = 0;
    const promoCode = typeof b.promoCode === "string" ? b.promoCode : "";
    if (promoCode.trim()) {
      const promo = await findPromo(promoCode, ctx.branch.id);
      if (!promo) {
        return apiError(400, "That promo code isn't valid for this order.", "PROMO_INVALID");
      }
      if (Number(cart.subtotal) < Number(promo.minOrderAmount)) {
        return apiError(400, "Order doesn't meet the promo minimum.", "PROMO_MIN_ORDER");
      }
      promoId = promo.id;
      promoDiscountUsd = promoDiscount(promo, cart.subtotal).discountUsd;
    }

    const totals = computeTotalsCore(cart.subtotal, currency, promoDiscountUsd);

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

    const statusSource = userId ? ("customer" as const) : ("system" as const);

    // Guest orders get a one-time lookup/cancel token; only its hash is stored.
    const guestToken = userId ? null : generateGuestAccessToken();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          branchId: ctx.branch.id,
          guestName: guestName || null,
          guestEmail: guestEmail || null,
          guestPhone: guestPhone || null,
          deliveryAddress: deliveryType === "delivery" ? deliveryAddress : null,
          deliveryNotes: deliveryNotes || null,
          deliveryType,
          status: "received",
          subtotal: clampUsd(cart.subtotal),
          tax: clampUsd(totals.tax),
          deliveryFee: clampUsd(totals.deliveryFee),
          discount: clampUsd(promoDiscountUsd),
          total: clampUsd(totals.total),
          currencyCode: ctx.currencyCode || "USD",
          paymentMethod,
          paymentStatus: "unpaid",
          stripePaymentIntentId: null,
          promoCodeId: promoId,
          etaMinutes: eta.totalMinutes,
          guestAccessTokenHash: guestToken?.hash ?? null,
        },
      });

      if (promoId) {
        await tx.promoCode.update({
          where: { id: promoId },
          data: { usedCount: { increment: 1 } },
        });
        await tx.promoRedemption.create({
          data: {
            promoCodeId: promoId,
            orderId: created.id,
            userId: userId ?? null,
            email: userId ? null : (guestEmail || null),
          },
        });
      }

      if (cart.lines.length > 0) {
        await tx.orderItem.createMany({
          data: cart.lines.map((l) => ({
            orderId: created.id,
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            unitPrice: clampUsd(l.unitPrice),
            customizationSnapshotJson: l.customizationSnapshot as unknown as Prisma.InputJsonValue,
          })),
        });
      }

      await tx.orderStatusLog.create({
        data: statusLogData({
          orderId: created.id,
          from: "pending",
          to: "received",
          source: statusSource,
          note: "Order placed" + (userId ? " (signed in)" : " (guest)"),
        }),
      });

      return created;
    });

    // Payment handling — trusted server-side only.
    //
    // Live Stripe: when configured, card orders get a real PaymentIntent and
    // remain `unpaid` until the verified /api/payments/webhook confirms them.
    // The client finalizes payment with the returned client_secret (through
    // Stripe Elements), so the raw card number is never handled by us.
    // Demo mode (no real Stripe): card captures are confirmed server-side here
    // so the app fully works without a gateway.
    const usingStripe = isStripeConfigured();

    let confirmed = order;
    let clientSecret: string | null = null;
    let intentId: string;

    if (paymentMethod === "cod") {
      intentId = stubIntent(paymentMethod, clampUsd(totals.total * 100), order.id);
    } else if (usingStripe) {
      const stripe = getStripe();
      if (!stripe) {
        return apiError(500, "Payment gateway unavailable", "GATEWAY_UNAVAILABLE");
      }
      const amountCents = Math.round(Number(totals.total) * 100);
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: currency === "GBP" ? "gbp" : "usd",
          automatic_payment_methods: { enabled: true },
          metadata: { orderId: order.id },
        });
        intentId = paymentIntent.id;
        clientSecret = paymentIntent.client_secret;
        // Persist the real intent id so the webhook can resolve the order.
        confirmed = await prisma.order.update({
          where: { id: order.id },
          data: { stripePaymentIntentId: paymentIntent.id },
        });
      } catch (e) {
        console.error("[api:orders:checkout] stripe intent failed:", e);
        return apiError(502, "Could not initialize secure payment", "GATEWAY_ERROR");
      }
    } else {
      // Demo mode: server-confirmed capture keeps the app usable without Stripe.
      intentId = stubIntent(paymentMethod, clampUsd(totals.total * 100), order.id);
      confirmed = await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "paid" },
      });
      await prisma.orderStatusLog.create({
        data: statusLogData({
          orderId: order.id,
          from: "received",
          to: "received",
          source: "payment",
          note: "Payment captured (stub gateway, server-confirmed)",
        }),
      });
    }

    // Best-effort order-confirmation email (handles both signed-in and guest).
    void (async () => {
      try {
        let email = guestEmail || null;
        let customerName = guestName || null;
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
          });
          if (user) {
            email = user.email;
            customerName = customerName || user.name;
          }
        }
        if (!email) return;

        const fmt = (n: number | string | Prisma.Decimal) =>
          Number(n).toFixed(2);
        const currency = ctx.currencyCode || "USD";

        await sendOrderConfirmation({
          to: email,
          customerName,
          orderId: order.id,
          branchName: ctx.branch.name,
          items: cart.lines.map((l) => ({
            name: l.name,
            quantity: l.quantity,
            unitPrice: fmt(l.unitPrice),
            lineTotal: fmt((l.unitPrice * l.quantity) || 0),
          })),
          subtotal: fmt(totals.subtotal),
          deliveryFee: fmt(totals.deliveryFee),
          tax: fmt(totals.tax),
          discount: fmt(promoDiscountUsd),
          total: fmt(confirmed?.total ?? totals.total),
          currency,
          deliveryType: deliveryType as string,
          etaMinutes: order.etaMinutes,
          deliveryAddress: deliveryAddress || null,
          paymentMethod: order.paymentMethod as string,
        });
      } catch (e) {
        console.error("[api:orders:checkout] email skipped:", e);
      }
    })();

    return NextResponse.json(
      {
        ok: true,
        order: {
          id: order.id,
        },
        status: order.status,
        eta,
        etaMinutes: order.etaMinutes,
        kitchenLoad: preparingCount,
        paymentIntentId: intentId,
        clientSecret,
        paymentStatus: confirmed?.paymentStatus ?? "unpaid",
        // Return authoritative server totals for the client to display.
        totals: {
          subtotal: totals.subtotal,
          deliveryFee: totals.deliveryFee,
          tax: totals.tax,
          discount: promoDiscountUsd,
          total: totals.total,
        },
        currencyCode: ctx.currencyCode,
        guestId,
        // One-time guest access token — show it only here (never persisted raw).
        guestAccessToken: guestToken?.raw ?? null,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[api:orders:checkout]", e);
    return apiError(500, "Failed to place order");
  }
}
