import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, ["admin", "staff"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  const search = req.nextUrl.searchParams;
  const status = search.get("status")?.trim(); // approved | pending | rejected
  const rating = search.get("rating")?.trim();
  const branchId = search.get("branchId")?.trim();
  const q = search.get("q")?.trim();
  const page = Math.max(1, Number(search.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(search.get("limit")) || 20));

  const where: Record<string, unknown> = {};
  if (status === "approved") where.isApproved = true;
  else if (status === "pending") where.isApproved = false;
  if (rating) {
    const r = Number(rating);
    if (Number.isInteger(r) && r >= 1 && r <= 5) where.rating = r;
  }
  if (branchId) where.branchId = branchId;
  if (q) {
    where.OR = [
      { comment: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { branch: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  try {
    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true, city: true } },
        },
      }),
    ]);

    const counts = await prisma.review.groupBy({ by: ["isApproved"], _count: { _all: true } });
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.isApproved ? "approved" : "pending"] = c._count._all;

    return NextResponse.json({
      ok: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        isApproved: r.isApproved,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
        user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : null,
        branch: { id: r.branch.id, name: r.branch.name, city: r.branch.city },
        orderId: r.orderId,
      })),
      counts: {
        approved: countMap.approved ?? 0,
        pending: countMap.pending ?? 0,
        total,
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("[api:admin:reviews:list]", e);
    return apiError(500, "Failed to load reviews");
  }
}
