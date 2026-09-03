import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/auth/http";
import {
  resolveOrderAccess,
  canAccessOrder,
  tokensMatch,
} from "@/lib/orders/access";
import { etaRemainingSeconds } from "@/lib/orders/eta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live order status lookup (customer view).
 *
 * Access rules (Phase 6.5):
 *  - A signed-in user may view any order where `Order.userId` matches.
 *  - Guests must provide BOTH the order email and the one-time access token
 *    returned at checkout. The raw token is verified (constant-time) against
 *    the stored SHA-256 hash; the hash is never exposed.
 *
 * Returns a clean status timeline (from OrderStatusLog) plus a live ETA countdown.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const sp = req.nextUrl.searchParams;
  const email = sp.get("email")?.trim().toLowerCase() ?? null;
  const token = sp.get("token") ?? null;

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
        deliveryType: true,
        deliveryAddress: true,
        deliveryNotes: true,
        subtotal: true,
        deliveryFee: true,
        tax: true,
        discount: true,
        total: true,
        currencyCode: true,
        etaMinutes: true,
        createdAt: true,
        branch: { select: { id: true, name: true, city: true } },
        items: {
          select: {
            id: true,
            menuItemId: true,
            quantity: true,
            unitPrice: true,
            customizationSnapshotJson: true,
          },
        },
        statusLogs: {
          select: {
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
            source: true,
          },
          orderBy: { createdAt: "asc" },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return apiError(404, "Order not found", "NOT_FOUND");
    }

    // Authorization: signed-in owner, or guest email + token.
    const access = await resolveOrderAccess(req, { email, token });
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

    const etaSeconds =
      order.etaMinutes && order.createdAt
        ? etaRemainingSeconds(order.createdAt, order.etaMinutes)
        : 0;

    const timeline = order.statusLogs.map((l) => ({
      status: l.toStatus,
      from: l.fromStatus,
      note: l.note,
      source: l.source,
      at: l.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        deliveryType: order.deliveryType,
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        createdAt: order.createdAt.toISOString(),
        branch: order.branch,
        customer: {
          name: order.user?.name ?? null,
          email: order.user?.email ?? order.guestEmail,
        },
        items: order.items.map((i) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          unitPrice: String(i.unitPrice),
          customizationSnapshot: i.customizationSnapshotJson,
        })),
        totals: {
          subtotal: String(order.subtotal),
          deliveryFee: String(order.deliveryFee),
          tax: String(order.tax),
          discount: String(order.discount),
          total: String(order.total),
        },
        currencyCode: order.currencyCode,
        etaMinutes: order.etaMinutes,
        etaRemainingSeconds: etaSeconds,
        timeline,
      },
    });
  } catch (e) {
    console.error("[api:orders:getOne]", e);
    return apiError(500, "Failed to load order");
  }
}