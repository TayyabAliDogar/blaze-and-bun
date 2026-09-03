import { prisma } from "@/lib/prisma";
import { getDefaultBranch, resolveBranch } from "@/lib/location/server";
import { getBranchStatus, parseSchedule } from "@/lib/location/availability";
import { orderingEnabledServer } from "@/lib/location/ordering";
import { computeTotalsCore } from "@/lib/money";
import { MENU_ITEMS } from "@/data/menu";
import type { NextRequest } from "next/server";
import type {
  Branch,
  PromoCode,
  OrderStatus,
  StatusChangeSource,
} from "@/generated/prisma/client";

export const CENTS = (n: number) => Math.round(n * 100);

/** Client contract for one cart line. */
export interface CartLineDTO {
  itemId: string;
  quantity: number;
  size?: string;
  bun?: string;
  extras?: string[];
  spiceLevel?: number;
  notes?: string;
  /** Free-text special/dietary/allergy instruction for this line. */
  specialInstructions?: string;
}

/** Server-resolved, validated cart line with the immutable snapshot. */
export interface ValidatedCartLine {
  lineId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  customizationSnapshot: Record<string, unknown>;
  customizationDelta: number;
}

/** A validated line whose unit price carries customization deltas (for audit). */
export type ServerCartLine = ValidatedCartLine;

/** Static customization catalog lookup by menu item id (mirrors the client customizer). */
export interface CatalogMenuItem {
  price: number;
  customization: {
    sizes?: { name: string; priceDelta: number }[];
    spiceLevels?: string[];
    bunTypes?: string[];
    addOns?: { name: string; price: number }[];
  };
}

/**
 * Per-branch USD price map + out-of-stock set. Same price resolution as
 * GET /api/menu. Out-of-stock (isOutOfStock) is resolved from the selected
 * branch's own pricing row.
 */
export async function buildPriceMapForBranch(
  branchId: string,
  fallbackBranchId: string
): Promise<{ map: Map<string, number>; outOfStock: Set<string> }> {
  const rows = await prisma.menuItemPrice.findMany({
    where: { branchId: { in: [branchId, fallbackBranchId] } },
    select: { itemId: true, branchId: true, price: true, isOutOfStock: true },
  });
  const primary = new Map<string, number>();
  const fallback = new Map<string, number>();
  const outOfStock = new Set<string>();
  for (const r of rows) {
    if (r.branchId === branchId) {
      primary.set(r.itemId, Number(r.price));
      if (r.isOutOfStock) outOfStock.add(r.itemId);
    }
    if (r.branchId === fallbackBranchId) fallback.set(r.itemId, Number(r.price));
  }
  const map = new Map<string, number>();
  for (const id of new Set([...primary.keys(), ...fallback.keys()])) {
    const p = primary.get(id);
    map.set(id, p !== undefined ? p : (fallback.get(id) as number));
  }
  return { map, outOfStock };
}

/** Static customization catalog lookup. Returns a normalized entry or null. */
export function getCatalog(itemId: string): CatalogMenuItem | null {
  const match = MENU_ITEMS.find((m) => m.id === itemId);
  if (!match) return null;
  return {
    price: match.price,
    customization: match.customization ?? {},
  };
}

/** Effective customization-price snapshot for a line (mirrors the client customizer math). */
export function buildCustomizationSnapshot(
  catalog: CatalogMenuItem,
  line: CartLineDTO
): { snapshot: Record<string, unknown>; delta: number } {
  const c = catalog.customization;
  let delta = 0;
  const snapshot: Record<string, unknown> = {};

  if (line.size) {
    const size = c.sizes?.find((s) => s.name === line.size);
    if (size) delta += Number(size.priceDelta);
    snapshot.size = line.size;
  }

  if (line.bun) snapshot.bun = line.bun;

  if (line.spiceLevel && line.spiceLevel > 0) {
    snapshot.spiceLevel = line.spiceLevel;
    // The client sends the 0-based heat index (spiceLevel = i in the customizer).
    // Read the SELECTED level directly to apply its "+$X.XX" upcharge.
    if (c.spiceLevels && line.spiceLevel > 0 && line.spiceLevel < c.spiceLevels.length) {
      const selected = c.spiceLevels[line.spiceLevel];
      const plus = selected?.split("+")[1];
      if (plus) {
        const v = Number(plus.replace("$", "").replace("£", ""));
        if (!Number.isNaN(v)) delta += v;
      }
    }
  }

  const extras = line.extras ?? [];
  if (extras.length > 0) {
    const prices = new Map((c.addOns ?? []).map((a) => [a.name, Number(a.price)]));
    for (const name of extras) {
      const p = prices.get(name);
      if (p !== undefined) delta += p;
    }
    snapshot.extras = extras;
  }

  if (line.notes) snapshot.notes = line.notes;
  if (line.specialInstructions) snapshot.specialInstructions = line.specialInstructions;
  return { snapshot, delta };
}

/** Validate + price a single cart line against DB price + customization catalog. Returns null when invalid. */
export async function validateCartLine(
  line: CartLineDTO,
  priceMap: Map<string, number>,
  outOfStock?: Set<string>,
  menuItem?: { id: string; name: string; isActive: boolean; isDeleted: boolean } | null
): Promise<ValidatedCartLine | null> {
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 50) return null;
  const row = menuItem ?? (await prisma.menuItem.findUnique({ where: { id: line.itemId } }));
  if (!row || !row.isActive || row.isDeleted) return null;
  const basePrice = priceMap.get(row.id);
  if (basePrice === undefined) return null;
  if (outOfStock?.has(row.id)) return null;
  const catalog = getCatalog(row.id);
  if (!catalog) return null;

  const { snapshot, delta } = buildCustomizationSnapshot(catalog, line);
  const unitPrice = Math.round((basePrice + delta) * 100) / 100;

  return {
    lineId: crypto.randomUUID(),
    menuItemId: row.id,
    name: row.name,
    quantity: line.quantity,
    unitPrice,
    customizationSnapshot: snapshot,
    customizationDelta: delta,
  };
}

export interface OfferSnapshot {
  discountUsd: number;
  percent: number;
  code: string;
  description: string;
}

/** Apply all policy/data max limits to a numeric amount so DB columns are not overrun. */
export function clampUsd(n: number): number {
  const v = Math.round(n * 100) / 100;
  return Math.max(0, Math.min(v, 999999));
}

/** Compute discount (USD) for a validated promo given a subtotal. Pure. */
export function promoDiscount(
  promo: PromoCode,
  subtotalUsd: number
): { usedPercent: number; discountUsd: number } {
  let usedPercent = Number(promo.discountValue);
  let discountUsd = 0;
  if (promo.discountType === "percent") {
    discountUsd = (subtotalUsd * usedPercent) / 100;
    if (promo.maxDiscount !== null && promo.maxDiscount !== undefined) {
      const cap = Number(promo.maxDiscount);
      discountUsd = Math.min(discountUsd, cap);
    }
  } else {
    discountUsd = Number(promo.discountValue);
    usedPercent = 0;
  }
  discountUsd = Math.max(0, Math.min(discountUsd, subtotalUsd));
  return { usedPercent, discountUsd };
}

/** Load a promo by normalized code with its branch scope resolved. */
export async function findPromo(
  rawCode: string,
  branchId: string
): Promise<PromoCode | null> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return null;
  const promo = await prisma.promoCode.findUnique({
    where: { code },
  });
  if (!promo) return null;
  if (!promo.isActive) return null;
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return null;
  if (promo.expiresAt && promo.expiresAt < now) return null;
  if (promo.branchId && promo.branchId !== branchId) return null;
  if (typeof promo.usageLimit === "number" && promo.usedCount >= promo.usageLimit) return null;
  return promo;
}

export interface OrderContext {
  branch: Branch;
  fromCookie: boolean;
  currencyCode: string;
  isOpen: boolean;
}

export async function resolveOrderContext(req: NextRequest): Promise<OrderContext> {
  const { branch, fromCookie } = await resolveBranch(req);
  const { isOpen } = getBranchStatus(
    parseSchedule(branch.schedule),
    branch.timezone || "UTC",
    new Date()
  );
  return {
    branch,
    fromCookie,
    currencyCode: branch.currencyCode || "USD",
    isOpen: orderingEnabledServer(isOpen),
  };
}

/** Server-side cart: validated lines + authoritative totals (all USD). */
export interface ServerCart {
  lines: ServerCartLine[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
}

export async function buildServerCart(
  lines: CartLineDTO[],
  branch: Branch
): Promise<ServerCart> {
  const fallback = await getDefaultBranch();
  const fallbackId = fallback?.id ?? branch.id;
  const { map, outOfStock } = await buildPriceMapForBranch(branch.id, fallbackId);

  // Batch menu-item lookup (single query instead of one per cart line).
  const ids = [...new Set(lines.map((l) => l.itemId))];
  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, isActive: true, isDeleted: true },
  });
  const itemById = new Map(items.map((it) => [it.id, it]));

  const valid: ServerCartLine[] = [];
  for (const line of lines) {
    const v = await validateCartLine(line, map, outOfStock, itemById.get(line.itemId));
    if (v) valid.push(v);
  }

  const subtotal = valid.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const currency = (branch.currencyCode || "USD") === "GBP" ? "GBP" : "USD";
  const totals = computeTotalsCore(subtotal, currency);
  return {
    lines: valid,
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    tax: totals.tax,
    total: totals.total,
  };
}

export interface StatusInput {
  orderId: string;
  from: OrderStatus | null;
  to: OrderStatus;
  source: StatusChangeSource;
  note?: string;
}

/** Record an immutable status transition inside the checkout transaction. */
export function statusLogData(input: StatusInput) {
  return {
    orderId: input.orderId,
    fromStatus: input.from,
    toStatus: input.to,
    source: input.source,
    note: input.note ?? null,
  };
}

export const STATUS_ORDER: OrderStatus[] = [
  "pending",
  "received",
  "preparing",
  "ready",
  "completed",
];
export const CANCELLED_ORDER: OrderStatus = "cancelled";
