import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/auth/http";
import { ACCESS_COOKIE } from "@/lib/auth/constants";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { hashAccessToken } from "@/lib/orders/access";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Order history for the signed-in user, or for a guest looked up by email.
 *
 * Signed-in users see their own orders via the access cookie.
 * Guests MUST pass BOTH `?email=` and `?token=`; only orders whose stored
 * `guestAccessTokenHash` matches the presented token are returned. A bare
 * email is never sufficient — this closes email-enumeration of guest orders.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const email = (sp.get("email") ?? "").trim().toLowerCase();
    const token = sp.get("token") ?? null;

    // A valid access cookie yields the signed-in user identity.
    let where: Prisma.OrderWhereInput | null = null;
    const accessRaw = req.cookies.get(ACCESS_COOKIE)?.value;
    if (accessRaw) {
      const payload = await verifyAccessToken(accessRaw);
      if (payload?.sub) where = { userId: payload.sub };
    }

    // Guest lookup requires the ownership token (verified against stored hash).
    if (where === null && email) {
      if (!token) {
        return apiError(401, "Provide your order email and access token", "AUTH_REQUIRED");
      }
      where = {
        guestEmail: email,
        userId: null,
        guestAccessTokenHash: hashAccessToken(token),
      };
    }

    if (!where) {
      return apiError(401, "Authenticate or provide your email and access token", "AUTH_REQUIRED");
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        deliveryType: true,
        subtotal: true,
        deliveryFee: true,
        tax: true,
        discount: true,
        total: true,
        currencyCode: true,
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
      },
    });

    return NextResponse.json({ ok: true, orders });
  } catch (e) {
    console.error("[api:orders]", e);
    return apiError(500, "Failed to load orders");
  }
}
