import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/auth/http";
import { statusLogData } from "@/lib/orders/cart";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Payment webhook.
 *
 * SECURITY: This endpoint mutates order payment state, so it MUST only accept
 * events signed with the gateway's shared secret. When STRIPE_WEBHOOK_SECRET is
 * configured we verify the standard `Stripe-Signature` header (timestamp + HMAC
 * over the raw body, per Stripe's v1 scheme). Without a valid signature the
 * request is rejected — there is NO forgeable "mark this order paid" path.
 *
 * In demo mode (no real Stripe) the client does NOT call this endpoint; card /
 * wallet captures are confirmed server-side in the checkout route. This endpoint
 * becomes active only once a live gateway is wired up.
 */
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verify a Stripe-style `Stripe-Signature` header against the shared secret. */
function verifyStripeSignature(payload: Buffer, signatureHeader: string | null): boolean {
  if (!WEBHOOK_SECRET || !signatureHeader) return false;
  if (!payload.length) return false;

  // v1 scheme: t=<unix_seconds>,v1=<hmac_hex> (-,v1= pairs).
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const idx = p.indexOf("=");
    if (idx > 0) acc[p.slice(0, idx)] = p.slice(idx + 1);
    return acc;
  }, {});

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject timestamps older than 5 minutes to blunt replay attacks.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${payload.toString("utf8")}`)
    .digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return constantTimeEqual(provided, expected);
}

export async function POST(req: NextRequest) {
  // Only real (signed) gateway events are accepted. Nothing else may mutate state.
  if (!verifyStripeSignature(Buffer.from(await req.arrayBuffer()), req.headers.get("stripe-signature"))) {
    return apiError(401, "Invalid webhook signature", "UNAUTHORIZED");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const body = (raw ?? {}) as {
    id?: unknown;
    type?: unknown;
    data?: { object?: { id?: unknown; payment_intent?: unknown; amount?: unknown; status?: unknown } };
  };

  const eventId = typeof body.id === "string" ? body.id : "";
  const type = typeof body.type === "string" ? body.type : "";
  const intent = body.data?.object;

  if (!eventId) return apiError(422, "eventId is required", "VALIDATION");
  if (!intent) return apiError(422, "Missing event data.object", "VALIDATION");

  const paymentIntentId =
    typeof intent.id === "string"
      ? intent.id
      : typeof intent.payment_intent === "string"
      ? intent.payment_intent
      : "";
  const declaredAmount =
    typeof intent.amount === "number" || typeof intent.amount === "string" ? Number(intent.amount) : null;

  const succeeded = /\.succeeded$/.test(type) || type === "payment_intent.captured";
  const failed = /\.failed$/.test(type) || type.includes("payment_failed");
  const canceled = type.includes("canceled") || type.includes("cancelled");

  try {
    // Idempotency check using a unique-ledger upsert (race-safe).
    const existing = await prisma.paymentEvent.findUnique({
      where: { eventId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, received: true, duplicate: true });
    }

    // Resolve the order from the payment intent id on the order.
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { id: true, total: true, paymentStatus: true, currencyCode: true },
    });
    if (!order) {
      return apiError(404, "Order not found for payment intent", "ORDER_NOT_FOUND");
    }

    // Amount verification: the gateway-reported amount must match the order total.
    if (declaredAmount !== null) {
      const expectedCents = Math.round(Number(order.total) * 100);
      if (declaredAmount !== expectedCents) {
        return apiError(409, "Payment amount does not match order total", "AMOUNT_MISMATCH");
      }
    }

    // Apply the transition in a transaction: record the event + mutate order.
    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.upsert({
        where: { eventId },
        create: {
          eventId,
          orderId: order.id,
          provider: WEBHOOK_SECRET ? "stripe" : "stub",
          payload: (intent ?? {}) as unknown as Prisma.InputJsonValue,
          eventType: type,
        },
        update: {},
      });

      if (succeeded && order.paymentStatus !== "paid") {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "paid" },
        });
        await tx.orderStatusLog.create({
          data: statusLogData({
            orderId: order.id,
            from: "received",
            to: "received",
            source: "payment",
            note: "Payment captured (webhook)",
          }),
        });
      } else if ((failed || canceled) && order.paymentStatus !== "failed") {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "failed" },
        });
        await tx.orderStatusLog.create({
          data: statusLogData({
            orderId: order.id,
            from: "received",
            to: "received",
            source: "payment",
            note: "Payment failed or canceled",
          }),
        });
      }
    });

    return NextResponse.json({ ok: true, received: true, duplicate: false, orderId: order.id });
  } catch (e) {
    console.error("[api:payments:webhook]", e);
    return apiError(500, "Webhook processing failed");
  }
}
