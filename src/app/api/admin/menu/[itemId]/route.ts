import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";
import { invalidatePattern } from "@/lib/cache";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  name?: unknown;
  categoryId?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  isActive?: unknown;
  prices?: unknown;
  /** { [branchId]: boolean } — per-branch out-of-stock flags. */
  stock?: unknown;
}

async function requireAuth(req: NextRequest) {
  try {
    return await requireAdmin(req, ["admin", "staff"]);
  } catch (e) {
    if (e instanceof AuthError) return { error: apiError(e.status, e.message) as never };
    return { error: apiError(401, "Not authenticated") as never };
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  const { itemId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = (raw ?? {}) as PatchBody;

  const data: Prisma.MenuItemUpdateInput = {};
  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return apiError(422, "name cannot be empty", "VALIDATION");
    data.name = name;
  }
  if (b.categoryId !== undefined) {
    const categoryId = typeof b.categoryId === "string" ? b.categoryId.trim() : "";
    if (!categoryId) return apiError(422, "categoryId is required", "VALIDATION");
    const categoryExists = await prisma.menuCategory.findFirst({
      where: { id: categoryId, isDeleted: false },
    });
    if (!categoryExists) return apiError(404, "Category not found", "NOT_FOUND");
    data.category = { connect: { id: categoryId } };
  }
  if (b.description !== undefined) {
    data.description = typeof b.description === "string" ? b.description.trim() || null : null;
  }
  if (b.imageUrl !== undefined) {
    data.imageUrl = typeof b.imageUrl === "string" ? b.imageUrl.trim() || null : null;
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") return apiError(422, "isActive must be a boolean", "VALIDATION");
    data.isActive = b.isActive;
  }

  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing) return apiError(404, "Menu item not found", "NOT_FOUND");

    await prisma.menuItem.update({ where: { id: itemId }, data });

    // Per-branch price updates: upsert each provided price, delete rows for
    // branches explicitly set to null (removing a branch pricing).
    const priceChanges: string[] = [];
    if (b.prices !== undefined && b.prices && typeof b.prices === "object") {
      const validBranches = new Set((await prisma.branch.findMany({ select: { id: true } })).map((x) => x.id));
      const priceChangesRecord: Record<string, number | null> = {};
      for (const [branchId, v] of Object.entries(b.prices as Record<string, unknown>)) {
        if (!validBranches.has(branchId)) continue;
        if (v === null || v === "") {
          priceChangesRecord[branchId] = null;
        } else {
          const n = typeof v === "number" ? v : Number(v);
          if (Number.isFinite(n) && n >= 0) priceChangesRecord[branchId] = Math.round(n * 100) / 100;
        }
      }

      for (const [branchId, price] of Object.entries(priceChangesRecord)) {
        if (price === null) {
          await prisma.menuItemPrice.deleteMany({ where: { itemId, branchId } });
          priceChanges.push(`${branchId}:deleted`);
        } else {
          await prisma.menuItemPrice.upsert({
            where: { itemId_branchId: { itemId, branchId } },
            update: { price: new Prisma.Decimal(price) },
            create: { itemId, branchId, price: new Prisma.Decimal(price) },
          });
          priceChanges.push(`${branchId}:${price}`);
        }
      }
    }

    // Per-branch out-of-stock updates: { branchId: boolean }.
    const stockChanges: string[] = [];
    if (b.stock && typeof b.stock === "object") {
      for (const [branchId, v] of Object.entries(b.stock as Record<string, unknown>)) {
        if (typeof v !== "boolean") continue;
        const updated = await prisma.menuItemPrice.updateMany({
          where: { itemId, branchId },
          data: { isOutOfStock: v },
        });
        if (updated.count > 0) stockChanges.push(`${branchId}:${v ? "oos" : "in"}`);
      }
    } else if (b.stock === null) {
      // Treat null as "clear all out-of-stock flags".
      await prisma.menuItemPrice.updateMany({
        where: { itemId },
        data: { isOutOfStock: false },
      });
      stockChanges.push("all:in");
    }

    await writeAudit({
      adminUserId: user.id,
      action: b.isActive !== undefined ? (b.isActive ? "MENU_ITEM_ACTIVE" : "MENU_ITEM_INACTIVE") : "MENU_ITEM_UPDATE",
      targetTable: "MenuItem",
      targetId: itemId,
      ipAddress: clientIp(req),
    });

    await invalidatePattern("menu:branch:");

    return NextResponse.json({
      ok: true,
      itemId,
      priceChanges,
      stockChanges,
      updatedBy: user.id,
    });
  } catch (e) {
    console.error("[api:admin:menu:patch]", e);
    return apiError(500, "Failed to update menu item");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  const { itemId } = await params;

  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing) return apiError(404, "Menu item not found", "NOT_FOUND");

    // Soft-delete so historical orders keep their reference.
    await prisma.menuItem.update({
      where: { id: itemId },
      data: { isDeleted: true, isActive: false },
    });

    await writeAudit({
      adminUserId: user.id,
      action: "MENU_ITEM_DELETE",
      targetTable: "MenuItem",
      targetId: itemId,
      ipAddress: clientIp(req),
    });

    await invalidatePattern("menu:branch:");

    return NextResponse.json({ ok: true, itemId, deleted: true });
  } catch (e) {
    console.error("[api:admin:menu:delete]", e);
    return apiError(500, "Failed to delete menu item");
  }
}
