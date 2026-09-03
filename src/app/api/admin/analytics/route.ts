import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/admin/guard";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startOfTodayUtc = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

    const branchId = req.nextUrl.searchParams.get("branch")?.trim() || undefined;
    const orderWhere = branchId ? { branchId } : {};
    const todayStart = startOfTodayUtc();

    // Revenue is recognized only for orders that were actually PAID. Order
    // counts below still include every non-cancelled order.
    const paidWhere: Prisma.OrderWhereInput = branchId
      ? { branchId, status: { not: "cancelled" }, paymentStatus: "paid" }
      : { status: { not: "cancelled" }, paymentStatus: "paid" };
    const todayPaidWhere: Prisma.OrderWhereInput = branchId
      ? { branchId, createdAt: { gte: todayStart }, status: { not: "cancelled" }, paymentStatus: "paid" }
      : { createdAt: { gte: todayStart }, status: { not: "cancelled" }, paymentStatus: "paid" };

    try {
      // Revenue metrics over PAID, non-cancelled orders.
      const revenueAgg = await prisma.order.aggregate({
        where: paidWhere,
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      });

      const todayOrders = await prisma.order.count({
        where: { ...orderWhere, createdAt: { gte: todayStart }, status: { not: "cancelled" } },
      });

      const revenueToday = await prisma.order.aggregate({
        where: todayPaidWhere,
        _sum: { total: true },
      });

    // Orders by status (for the live board summary).
    const statusGroups = await prisma.order.groupBy({
      by: ["status"],
      where: orderWhere,
      _count: { _all: true },
    });

    const statusBreakdown = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all])
    );

    // Top selling items — join OrderItem -> Order (PAID, non-cancelled, optional branch).
    const topItems: { menuItemId: string; name: string; branchId: string; branchName: string; quantity: number; revenue: number }[] = [];
    const itemRows = await prisma.orderItem.findMany({
      where: branchId
        ? { order: { branchId, status: { not: "cancelled" }, paymentStatus: "paid" } }
        : { order: { status: { not: "cancelled" }, paymentStatus: "paid" } },
      select: {
        menuItemId: true,
        quantity: true,
        unitPrice: true,
        order: { select: { branchId: true } },
      },
    });

    const menuNames = new Map<string, string>();
    const itemIds = new Set(itemRows.map((r) => r.menuItemId));
    if (itemIds.size > 0) {
      const items = await prisma.menuItem.findMany({
        where: { id: { in: [...itemIds] } },
        select: { id: true, name: true },
      });
      for (const it of items) menuNames.set(it.id, it.name);
    }
    const branchNames = new Map<string, string>();
    const branchIds = new Set(itemRows.map((r) => r.order.branchId));
    if (branchIds.size > 0) {
      const branches = await prisma.branch.findMany({
        where: { id: { in: [...branchIds] } },
        select: { id: true, name: true },
      });
      for (const b of branches) branchNames.set(b.id, b.name);
    }

    const agg = new Map<string, { qty: number; rev: number }>();
    for (const r of itemRows) {
      const key = `${r.order.branchId}:${r.menuItemId}`;
      const cur = agg.get(key) ?? { qty: 0, rev: 0 };
      cur.qty += r.quantity;
      cur.rev += Number(r.unitPrice) * r.quantity;
      agg.set(key, cur);
    }

    for (const [key, v] of agg.entries()) {
      const [bid, mid] = key.split(":");
      topItems.push({
        menuItemId: mid,
        name: menuNames.get(mid) ?? "(item)",
        branchId: bid,
        branchName: branchNames.get(bid) ?? bid,
        quantity: v.qty,
        revenue: Math.round(v.rev * 100) / 100,
      });
    }
    topItems.sort((a, b) => b.quantity - a.quantity);
    // Top 5 per branch (topItems is pre-sorted by quantity).
    const topByBranch = new Map<string, typeof topItems>();
    for (const t of topItems) {
      const arr = topByBranch.get(t.branchId);
      if (!arr) {
        topByBranch.set(t.branchId, [t]);
      } else if (arr.length < 5) {
        arr.push(t);
      }
    }

    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
        currencyCode: true,
        isActive: true,
        _count: { select: { orders: { where: { status: { not: "cancelled" } } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Per-branch revenue (paid orders only).
    const revenueByBranch = await prisma.order.groupBy({
      by: ["branchId"],
      where: { status: { not: "cancelled" }, paymentStatus: "paid" },
      _sum: { total: true },
    });
    const revMap = new Map(revenueByBranch.map((r) => [r.branchId, Number(r._sum.total ?? 0)]));

    return NextResponse.json({
      ok: true,
      totals: {
        revenue: Number(revenueAgg._sum.total ?? 0),
        orders: revenueAgg._count,
        avgOrderValue:
          revenueAgg._count > 0
            ? Number(revenueAgg._sum.total ?? 0) / revenueAgg._count
            : 0,
      },
      today: {
        orders: todayOrders,
        revenue: Number(revenueToday._sum.total ?? 0),
      },
      statusBreakdown,
      topByBranch: Object.fromEntries(topByBranch),
      branches: branches.map((b) => ({
        ...b,
        revenue: revMap.get(b.id) ?? 0,
        orders: b._count.orders,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[api:admin:analytics]", e);
    return apiError(500, "Failed to load analytics");
  }
}
