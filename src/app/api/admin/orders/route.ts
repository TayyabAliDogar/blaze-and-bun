import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/admin/guard";
import type { OrderStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "received",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  const sp = req.nextUrl.searchParams;
  const branchId = sp.get("branch")?.trim() || undefined;
  const status = sp.get("status")?.trim() || undefined;
  const q = sp.get("q")?.trim() || undefined;
  const from = sp.get("from")?.trim() || undefined;
  const to = sp.get("to")?.trim() || undefined;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("limit") ?? 15) || 15));

  if (status && !VALID_STATUSES.includes(status as OrderStatus)) {
    return apiError(422, "Invalid order status", "VALIDATION");
  }

  try {
    const where: Record<string, unknown> = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status as OrderStatus;

    const createdAt: { gte?: Date; lte?: Date } = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) createdAt.lte = d;
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { guestName: { contains: q, mode: "insensitive" } },
        { guestEmail: { contains: q, mode: "insensitive" } },
        { guestPhone: { contains: q } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          deliveryType: true,
          subtotal: true,
          deliveryFee: true,
          tax: true,
          discount: true,
          total: true,
          currencyCode: true,
          guestName: true,
          guestEmail: true,
          guestPhone: true,
          deliveryAddress: true,
          deliveryNotes: true,
          etaMinutes: true,
          createdAt: true,
          branch: { select: { id: true, name: true, city: true } },
          user: { select: { id: true, name: true, email: true } },
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
      }),
    ]);

    return NextResponse.json({
      ok: true,
      orders,
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
      requestedBy: { id: user.id, role: user.role },
      requestedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[api:admin:orders]", e);
    return apiError(500, "Failed to load orders");
  }
}
