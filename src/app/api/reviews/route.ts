import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/auth/http";
import { ACCESS_COOKIE } from "@/lib/auth/constants";
import { requireUser, AuthError } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req.cookies.get(ACCESS_COOKIE)?.value ?? undefined, ["customer", "staff", "admin"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = raw as { orderId?: unknown; rating?: unknown; comment?: unknown };

  const orderId = typeof b.orderId === "string" ? b.orderId.trim() : "";
  if (!orderId) return apiError(422, "orderId is required", "VALIDATION");

  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return apiError(422, "rating must be a whole number between 1 and 5", "VALIDATION");
  }
  const comment = typeof b.comment === "string" ? b.comment.trim() : "";
  if (comment.length > 1000) {
    return apiError(422, "comment must be 1000 characters or fewer", "VALIDATION");
  }

  try {
    // The order must belong to this user and be COMPLETED before they can review.
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      select: { id: true, status: true, branchId: true },
    });
    if (!order) {
      return apiError(404, "Order not found", "ORDER_NOT_FOUND");
    }
    if (order.status !== "completed") {
      return apiError(409, "You can only review a completed order", "ORDER_NOT_COMPLETED");
    }

    const existing = await prisma.review.findUnique({ where: { orderId } });
    if (existing) {
      return apiError(409, "You have already reviewed this order", "ALREADY_REVIEWED");
    }

    const review = await prisma.review.create({
      data: {
        userId: user.id,
        branchId: order.branchId,
        orderId,
        rating,
        comment: comment || null,
        isApproved: false,
        source: "internal",
      },
      select: { id: true, rating: true, comment: true, isApproved: true, createdAt: true },
    });

    return NextResponse.json(
      { ok: true, review, status: "pending" },
      { status: 201 }
    );
  } catch (e) {
    console.error("[api:reviews:post]", e);
    return apiError(500, "Failed to submit review");
  }
}
