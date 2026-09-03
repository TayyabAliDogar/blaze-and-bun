import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuth(req: NextRequest) {
  try {
    return await requireAdmin(req, ["admin", "staff"]);
  } catch (e) {
    if (e instanceof AuthError) return { error: apiError(e.status, e.message) };
    return { error: apiError(401, "Not authenticated") };
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  const { reviewId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = raw as { isApproved?: unknown; hardDelete?: unknown };

  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) return apiError(404, "Review not found", "NOT_FOUND");

  // Support deletion through PATCH { hardDelete: true } per spec.
  if (b.hardDelete === true) {
    await prisma.review.delete({ where: { id: reviewId } });
    await writeAudit({
      adminUserId: user.id,
      action: "REVIEW_DELETE",
      targetTable: "Review",
      targetId: reviewId,
      ipAddress: clientIp(req),
    });
    return NextResponse.json({ ok: true, reviewId, deleted: true });
  }

  if (b.isApproved === undefined) {
    return apiError(422, "isApproved (boolean) or hardDelete is required", "VALIDATION");
  }
  if (typeof b.isApproved !== "boolean") {
    return apiError(422, "isApproved must be a boolean", "VALIDATION");
  }

  try {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: b.isApproved },
      select: { id: true, isApproved: true },
    });

    await writeAudit({
      adminUserId: user.id,
      action: b.isApproved ? "REVIEW_APPROVE" : "REVIEW_REJECT",
      targetTable: "Review",
      targetId: reviewId,
      ipAddress: clientIp(req),
    });

    return NextResponse.json({ ok: true, review: review, updatedBy: user.id });
  } catch (e) {
    console.error("[api:admin:reviews:patch]", e);
    return apiError(500, "Failed to update review");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  const { reviewId } = await params;

  try {
    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) return apiError(404, "Review not found", "NOT_FOUND");

    await prisma.review.delete({ where: { id: reviewId } });

    await writeAudit({
      adminUserId: user.id,
      action: "REVIEW_DELETE",
      targetTable: "Review",
      targetId: reviewId,
      ipAddress: clientIp(req),
    });

    return NextResponse.json({ ok: true, reviewId, deleted: true });
  } catch (e) {
    console.error("[api:admin:reviews:delete]", e);
    return apiError(500, "Failed to delete review");
  }
}
