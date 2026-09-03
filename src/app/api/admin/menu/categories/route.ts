import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateCategoryBody {
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

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const user = auth;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const b = (raw ?? {}) as CreateCategoryBody;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return apiError(422, "name is required", "VALIDATION");

  let displayOrder = typeof b.displayOrder === "number" ? Math.floor(b.displayOrder) : null;
  if (displayOrder === null || Number.isNaN(displayOrder)) {
    const max = await prisma.menuCategory.aggregate({ _max: { displayOrder: true } });
    displayOrder = (max._max.displayOrder ?? -1) + 1;
  }

  try {
    const category = await prisma.menuCategory.create({
      data: { name, displayOrder },
    });

    await writeAudit({
      adminUserId: user.id,
      action: "MENU_CATEGORY_CREATE",
      targetTable: "MenuCategory",
      targetId: category.id,
      ipAddress: clientIp(req),
    });

    return NextResponse.json(
      { ok: true, category: { id: category.id, name: category.name, displayOrder: category.displayOrder } },
      { status: 201 }
    );
  } catch (e) {
    console.error("[api:admin:menu:categories:post]", e);
    return apiError(500, "Failed to create category");
  }
}
