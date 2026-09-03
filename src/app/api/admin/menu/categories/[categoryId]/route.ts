import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  name?: unknown;
  displayOrder?: unknown;
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
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  const { categoryId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = (raw ?? {}) as PatchBody;

  const data: { name?: string; displayOrder?: number } = {};
  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return apiError(422, "name cannot be empty", "VALIDATION");
    data.name = name;
  }
  if (b.displayOrder !== undefined) {
    if (typeof b.displayOrder !== "number" || Number.isNaN(b.displayOrder)) {
      return apiError(422, "displayOrder must be a number", "VALIDATION");
    }
    data.displayOrder = Math.floor(b.displayOrder);
  }

  try {
    const existing = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
    if (!existing) return apiError(404, "Category not found", "NOT_FOUND");

    const category = await prisma.menuCategory.update({ where: { id: categoryId }, data });

    await writeAudit({
      adminUserId: user.id,
      action: "MENU_CATEGORY_UPDATE",
      targetTable: "MenuCategory",
      targetId: categoryId,
      ipAddress: clientIp(req),
    });

    return NextResponse.json({
      ok: true,
      category: { id: category.id, name: category.name, displayOrder: category.displayOrder },
    });
  } catch (e) {
    console.error("[api:admin:menu:categories:patch]", e);
    return apiError(500, "Failed to update category");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  const { categoryId } = await params;

  try {
    const existing = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
    if (!existing) return apiError(404, "Category not found", "NOT_FOUND");

    const itemCount = await prisma.menuItem.count({ where: { categoryId, isDeleted: false } });
    if (itemCount > 0) {
      return apiError(
        409,
        `Category still has ${itemCount} active item${itemCount === 1 ? "" : "s"}. Move or delete them first.`,
        "CATEGORY_NOT_EMPTY"
      );
    }

    await prisma.menuCategory.update({
      where: { id: categoryId },
      data: { isDeleted: true },
    });

    await writeAudit({
      adminUserId: user.id,
      action: "MENU_CATEGORY_DELETE",
      targetTable: "MenuCategory",
      targetId: categoryId,
      ipAddress: clientIp(req),
    });

    return NextResponse.json({ ok: true, categoryId, deleted: true });
  } catch (e) {
    console.error("[api:admin:menu:categories:delete]", e);
    return apiError(500, "Failed to delete category");
  }
}
