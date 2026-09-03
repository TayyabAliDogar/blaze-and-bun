import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { apiError } from "@/lib/auth/http";
import { requireAdmin, writeAudit, clientIp } from "@/lib/admin/guard";
import { invalidatePattern } from "@/lib/cache";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateItemBody {
  name?: unknown;
  categoryId?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  isActive?: unknown;
  prices?: unknown;
  outOfStockBranches?: unknown;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, ["admin", "staff"]);
  } catch (e) {
    if (e instanceof AuthError) return apiError(e.status, e.message);
    return apiError(401, "Not authenticated");
  }

  try {
    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, city: true, country: true, currencyCode: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const categories = await prisma.menuCategory.findMany({
      where: { isDeleted: false },
      orderBy: { displayOrder: "asc" },
      include: { menuItems: true },
    });

    const items = categories.flatMap((c) => c.menuItems);
    const priceRows = await prisma.menuItemPrice.findMany({
      where: { itemId: { in: items.map((i) => i.id) } },
      select: { itemId: true, branchId: true, price: true, isOutOfStock: true },
    });

    const priceMapByItem = new Map<string, Record<string, number>>();
    const oosMapByItem = new Map<string, Set<string>>();
    for (const p of priceRows) {
      const m = priceMapByItem.get(p.itemId) ?? {};
      m[p.branchId] = Number(p.price);
      priceMapByItem.set(p.itemId, m);
      if (p.isOutOfStock) {
        const s = oosMapByItem.get(p.itemId) ?? new Set();
        s.add(p.branchId);
        oosMapByItem.set(p.itemId, s);
      }
    }

    return NextResponse.json({
      ok: true,
      branches,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        displayOrder: c.displayOrder,
        items: c.menuItems.map((it) => ({
          id: it.id,
          name: it.name,
          description: it.description,
          imageUrl: it.imageUrl,
          categoryId: it.categoryId,
          isActive: it.isActive,
          isDeleted: it.isDeleted,
          createdAt: it.createdAt.toISOString(),
          prices: priceMapByItem.get(it.id) ?? {},
          outOfStockBranches: [...(oosMapByItem.get(it.id) ?? [])],
        })),
      })),
    });
  } catch (e) {
    console.error("[api:admin:menu:get]", e);
    return apiError(500, "Failed to load the menu");
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAdmin(req, ["admin", "staff"]);
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
  const b = (raw ?? {}) as CreateItemBody;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const categoryId = typeof b.categoryId === "string" ? b.categoryId.trim() : "";
  if (!name) return apiError(422, "name is required", "VALIDATION");
  if (!categoryId) return apiError(422, "categoryId is required", "VALIDATION");

  const description = typeof b.description === "string" ? b.description.trim() || null : null;
  const imageUrl = typeof b.imageUrl === "string" ? b.imageUrl.trim() || null : null;
  const isActive = typeof b.isActive === "boolean" ? b.isActive : true;

  // Per-branch out-of-stock: { [branchId]: boolean }
  const outOfStockSet = new Set<string>();
  if (b.outOfStockBranches && typeof b.outOfStockBranches === "object" && Array.isArray(b.outOfStockBranches)) {
    for (const v of b.outOfStockBranches) {
      if (typeof v === "string" && v) outOfStockSet.add(v);
    }
  }

  // Prices: { [branchId]: number }
  const prices: Record<string, number> = {};
  if (b.prices && typeof b.prices === "object") {
    for (const [branchId, v] of Object.entries(b.prices as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      if (Number.isFinite(n) && n >= 0) prices[branchId] = Math.round(n * 100) / 100;
    }
  }

  try {
    const categoryExists = await prisma.menuCategory.findFirst({
      where: { id: categoryId, isDeleted: false },
    });
    if (!categoryExists) return apiError(404, "Category not found", "NOT_FOUND");

    const validBranches = new Set((await prisma.branch.findMany({ select: { id: true } })).map((x) => x.id));
    const priceData = Object.entries(prices)
      .filter(([bid]) => validBranches.has(bid))
      .map(([bid, price]) => ({
        branchId: bid,
        price: new Prisma.Decimal(price),
        isOutOfStock: outOfStockSet.has(bid),
      }));

    const item = await prisma.menuItem.create({
      data: {
        name,
        categoryId,
        description,
        imageUrl,
        isActive,
        prices: { create: priceData },
      },
    });

    await writeAudit({
      adminUserId: user.id,
      action: "MENU_ITEM_CREATE",
      targetTable: "MenuItem",
      targetId: item.id,
      ipAddress: clientIp(req),
    });

    await invalidatePattern("menu:branch:");

    return NextResponse.json({ ok: true, item: { id: item.id, name: item.name } }, { status: 201 });
  } catch (e) {
    console.error("[api:admin:menu:post]", e);
    return apiError(500, "Failed to create menu item");
  }
}
