import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/auth/http";
import {
  resolveOrderAccess,
  canAccessOrder,
  tokensMatch,
  CANCELLATION_WINDOW_MS,
  CANCELLABLE_STATUSES,
  type OrderAccess,
} from "@/lib/orders/access";
import type { Prisma } from "@/generated/prisma/client";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CancelBody {
  reason?: unknown;
  token?: unknown;
  email?: unknown;
}

/**
 * Customer / guest self-service cancellation.
 *
 * Succeeds ONLY when:
 *  - The caller is authorized (signed-in owner, or guest email + token), AND
 *  - The order status is PENDING or RECEIVED, AND
 *  - The order was created within the last 120 seconds.
 *
 * On success the order moves to `cancelled` (with the reason logged in
 * OrderStatusLog) and `payment_status` is updated to `refunded` when it had
 * already been captured (`paid`), else left `unpaid`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = (raw ?? {}) as CancelBody;
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 300) : "";
  const token = typeof b.token === "string" ? b.token : null;
  const email =
    typeof b.email === "string" ? b.email.trim().toLowerCase() : null;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        guestEmail: true,
        guestAccessTokenHash: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        branchId: true,
        total: true,
        currencyCode: true,
        stripePaymentIntentId: true,
      },
    });

    if (!order) {
      return apiError(404, "Order not found", "NOT_FOUND");
    }

    // Authorization
    const access: OrderAccess = await resolveOrderAccess(req, { email, token });
    if (!access) {
      return apiError(401, "Authenticate or provide your order email and access token", "AUTH_REQUIRED");
    }
    if (access.kind === "guest") {
      if (!tokensMatch(token, order.guestAccessTokenHash)) {
        return apiError(401, "Invalid order access token", "AUTH_REQUIRED");
      }
    }
    if (!canAccessOrder(access, { userId: order.userId, guestEmail: order.guestEmail })) {
      return apiError(403, "You don't have access to this order", "FORBIDDEN");
    }

    // 1. Status must be cancellable.
    if (!CANCELLABLE_STATUSES.has(order.status as "pending" | "received")) {
      return apiError(
        409,
        "This order has already left the kitchen and can no longer be cancelled.",
        "NOT_CANCELLABLE"
      );
    }

    // 2. Cancellation window (created within last 120 seconds).
    const ageMs = Date.now() - new Date(order.createdAt).getTime();
    if (ageMs > CANCELLATION_WINDOW_MS) {
      return apiError(
        409,
        "The 2-minute cancellation window has passed. Please contact the branch for help.",
        "CANCEL_WINDOW_EXPIRED"
      );
    }

    const note = reason
      ? `Cancelled by customer: ${reason}`
      : "Cancelled by customer";

    // For live Stripe orders that were already captured (`paid`), issue a real
    // refund through the gateway so the customer isn't charged. Demo/stub intent
    // ids (`pi_stub_...`) and non-Stripe methods never reach the gateway.
    const realIntent =
      isStripeConfigured() &&
      order.paymentStatus === "paid" &&
      typeof order.stripePaymentIntentId === "string" &&
      order.stripePaymentIntentId.startsWith("pi_");

    let refundSucceeded = !realIntent;
    if (realIntent) {
      try {
        const stripe = getStripe();
        if (!stripe) throw new Error("stripe client unavailable");
        await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId as string,
          reason: "requested_by_customer",
          metadata: { orderId: order.id },
        });
        refundSucceeded = true;
      } catch (e) {
        // Refund failed — do NOT claim the payment was refunded. Cancel the order
        // anyway and surface the discrepancy via status log + server log.
        console.error("[api:orders:cancel] stripe refund failed:", e);
      }
    }

    // `refunded` only when the payment was captured AND (no real intent to refund
    // OR the gateway refund succeeded). Otherwise leave it `paid` (refund pending)
    // or `unpaid` for never-charged orders.
    const paymentStatus: Prisma.OrderUpdateInput["paymentStatus"] =
      order.paymentStatus === "paid"
        ? refundSucceeded
          ? "refunded"
          : "paid"
        : "unpaid";

    const refundNote = realIntent
      ? refundSucceeded
        ? `Cancelled by customer — Stripe refund initiated.`
        : `Cancelled by customer — refund FAILED, customer may still be charged.`
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const moved = await tx.order.update({
        where: { id: order.id },
        data: { status: "cancelled", paymentStatus },
        select: { id: true, status: true, paymentStatus: true },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "cancelled",
          source: "customer",
          note: refundNote ? `${note} ${refundNote}` : note,
        },
      });

      return moved;
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      cancelledAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[api:orders:cancel]", e);
    return apiError(500, "Failed to cancel order");
  }
}