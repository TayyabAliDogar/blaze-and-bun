import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, clientIp } from "@/lib/admin/guard";
import { validateTransition } from "@/lib/admin/orderStateMachine";
import type { OrderStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  status?: unknown;
  note?: unknown;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  let user;
  try {
    user = await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  const { orderId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = (raw ?? {}) as Body;
  const status = b.status as OrderStatus | undefined;
  if (!status || !["pending", "received", "preparing", "ready", "completed", "cancelled"].includes(status)) {
    return apiError(422, "A valid target status is required", "VALIDATION");
  }
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : null;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) return apiError(404, "Order not found", "NOT_FOUND");

    const err = validateTransition(order.status, status);
    if (err) return apiError(409, err, "INVALID_TRANSITION");

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: status,
          source: user.role === "staff" ? "staff" : "admin",
          note: note ?? `Status changed to ${status}`,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          adminUserId: user.id,
          action: `ORDER_STATUS_${order.status}->${status}`,
          targetTable: "Order",
          targetId: order.id,
          ipAddress: clientIp(req),
        },
      });
    });

    return NextResponse.json({ ok: true, orderId: order.id, status });
  } catch (e) {
    console.error("[api:admin:orders:patch]", e);
    return apiError(500, "Failed to update order");
  }
}
