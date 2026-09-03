import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBranch, getDefaultBranch, toBranchDTO, currencySymbol } from "@/lib/location/server";
import { apiError } from "@/lib/auth/http";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MENU_CACHE_TTL_MS = 30 * 1000; // 30s; invalidated by admin edits

interface PriceMap {
  [itemId: string]: number;
}

interface PriceResolution {
  priceMap: PriceMap;
  /** Item ids that are out of stock for the primary (selected) branch. */
  outOfStock: Set<string>;
  /** True when at least one item had to be resolved from the fallback branch. */
  usedFallback: boolean;
}

async function buildPriceMap(
  branchId: string,
  fallbackBranchId: string
): Promise<PriceResolution> {
  const prices = await prisma.menuItemPrice.findMany({
    where: { branchId: { in: [branchId, fallbackBranchId] } },
    select: { itemId: true, branchId: true, price: true, isOutOfStock: true },
  });

  const primary = new Map<string, number>();
  const fallback = new Map<string, number>();
  const outOfStock = new Set<string>();

  for (const p of prices) {
    if (p.branchId === branchId) {
      primary.set(p.itemId, Number(p.price));
      if (p.isOutOfStock) outOfStock.add(p.itemId);
    }
    if (p.branchId === fallbackBranchId) fallback.set(p.itemId, Number(p.price));
  }

  // Resolution order: selected branch price → default ("main") branch price.
  const merged: PriceMap = {};
  const ids = new Set([...primary.keys(), ...fallback.keys()]);
  let usedFallback = false;
  for (const id of ids) {
    const primaryValue = primary.get(id);
    if (primaryValue !== undefined) {
      merged[id] = primaryValue;
    } else {
      const fallbackValue = fallback.get(id);
      if (fallbackValue !== undefined) {
        merged[id] = fallbackValue;
        usedFallback = true;
      }
    }
  }
  return { priceMap: merged, outOfStock, usedFallback };
}

async function loadMenuData(
  branchId: string,
  fallbackId: string,
  fallbackUsed: (used: boolean) => void
) {
  const { priceMap, outOfStock, usedFallback } = await buildPriceMap(branchId, fallbackId);
  fallbackUsed(usedFallback);

  const categories = await prisma.menuCategory.findMany({
    where: { isDeleted: false },
    orderBy: { displayOrder: "asc" },
    include: {
      menuItems: {
        where: { isActive: true, isDeleted: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          categoryId: true,
        },
      },
    },
  });

  const resolved = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.displayOrder,
      items: c.menuItems
        .filter((it) => priceMap[it.id] !== undefined)
        .map((it) => ({
          id: it.id,
          name: it.name,
          description: it.description,
          imageUrl: it.imageUrl,
          categoryId: it.categoryId,
          price: priceMap[it.id],
          isOutOfStock: outOfStock.has(it.id),
        })),
    }))
    .filter((c) => c.items.length > 0);

  return resolved;
}

export async function GET(req: NextRequest) {
  try {
    const { branch: selected, fromCookie } = await resolveBranch(req);
    const fallbackBranch = await getDefaultBranch();
    const fallbackId = (fallbackBranch?.id ?? selected.id) as string;

    let usedFallback = false;
    // Cache the heavy menu payload per branch; branch/availability stays live.
    const resolved = await cached(
      `menu:branch:${selected.id}`,
      () => loadMenuData(selected.id, fallbackId, (u) => { usedFallback = u; }),
      MENU_CACHE_TTL_MS
    );

    return NextResponse.json({
      ok: true,
      branch: {
        id: selected.id,
        name: selected.name,
        city: selected.city,
        currencyCode: selected.currencyCode,
        currencySymbol: currencySymbol(selected.currencyCode),
        isOpen: toBranchDTO(selected).isOpen,
      },
      currencyCode: selected.currencyCode,
      currencySymbol: currencySymbol(selected.currencyCode),
      fallbackBranchId: usedFallback ? fallbackId : null,
      basedOnCookie: fromCookie,
      categories: resolved,
    });
  } catch (e) {
    console.error("[api:menu]", e);
    return apiError(500, "Failed to load the menu");
  }
}