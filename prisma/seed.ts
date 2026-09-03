import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { BRANCHES, BRANCH_SCHEDULES } from "../src/data/branches";
import { MENU_ITEMS } from "../src/data/menu";
import { REVIEWS } from "../src/data/reviews";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
});

const prisma = new PrismaClient({ adapter });

const CURRENCY_BY_CITY: Record<string, string> = {
  "New York, NY": "USD",
  "Brooklyn, NY": "USD",
  "Los Angeles, CA": "USD",
  "London, UK": "GBP",
};

const TIMEZONE_BY_ID: Record<string, string> = {
  "nyc-soho": "America/New_York",
  "nyc-brooklyn": "America/New_York",
  "la-arts-district": "America/Los_Angeles",
  "london-shoreditch": "Europe/London",
};

const DELIVERY_KM_BY_ID: Record<string, number> = {
  "nyc-soho": 16,
  "nyc-brooklyn": 12,
  "la-arts-district": 20,
  "london-shoreditch": 12,
};

const DEFAULT_BRANCH_ID = "nyc-soho";
const FEATURED_BRANCH_IDS = ["nyc-soho", "la-arts-district"];

const CATEGORY_ORDER = [
  "burgers",
  "chicken",
  "wraps",
  "sides",
  "salads",
  "combos",
  "beverages",
  "desserts",
  "dips",
  "pizza",
];

async function main() {
  console.log("Seeding database…");

  // ---- Branches ----
  const branchRows = BRANCHES.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city,
    country: b.city.split(",")[1]?.trim() ?? "US",
    currencyCode: CURRENCY_BY_CITY[b.city] ?? "USD",
    lat: b.coordinates.lat,
    lng: b.coordinates.lng,
    phone: b.phone,
    timezone: TIMEZONE_BY_ID[b.id] ?? "America/New_York",
    openingHours: b.hours,
    schedule: (BRANCH_SCHEDULES[b.id] ?? BRANCH_SCHEDULES["nyc-soho"]!) as unknown as Prisma.InputJsonValue,
    deliveryRadiusKm: DELIVERY_KM_BY_ID[b.id] ?? 8,
    isDefault: b.id === DEFAULT_BRANCH_ID,
    isFeatured: FEATURED_BRANCH_IDS.includes(b.id),
    parking: b.parking ?? null,
    isActive: true,
  }));
  await Promise.all(
    branchRows.map(async (b) =>
      prisma.branch.upsert({
        where: { id: b.id },
        update: b,
        create: b,
      })
    )
  );
  console.log(`  ✓ ${branchRows.length} branches`);

  // ---- Categories ----
  const categoryRows = CATEGORY_ORDER.map((name, i) => ({
    id: `cat-${name}`,
    name,
    displayOrder: i,
  }));
  await prisma.menuCategory.createMany({ data: categoryRows, skipDuplicates: true });
  console.log(`  ✓ ${categoryRows.length} categories`);

  // ---- Menu items ----
  const itemRows = MENU_ITEMS.filter((m) => CATEGORY_ORDER.includes(m.category)).map((m) => ({
    id: m.id,
    categoryId: `cat-${m.category}`,
    name: m.name,
    description: m.description,
    imageUrl: m.image || null,
    isActive: true,
  }));
  await prisma.menuItem.createMany({ data: itemRows, skipDuplicates: true });
  console.log(`  ✓ ${itemRows.length} menu items`);

  // ---- Per-branch prices (base price on every branch for now) ----
  const priceRows = branchRows.flatMap((b) =>
    itemRows.map((it) => ({
      itemId: it.id,
      branchId: b.id,
      price: new Prisma.Decimal(
        MENU_ITEMS.find((m) => m.id === it.id)!.price
      ),
    }))
  );
  await prisma.menuItemPrice.createMany({ data: priceRows, skipDuplicates: true });
  console.log(`  ✓ ${priceRows.length} per-branch prices`);

  // ---- Demo admin account ----
  // Password comes from ADMIN_SEED_PASSWORD. To avoid a guessable default
  // credential, the demo fallback is ONLY allowed in non-production; in
  // production the seed hard-fails if ADMIN_SEED_PASSWORD is unset.
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const adminPassword =
    process.env.ADMIN_SEED_PASSWORD ??
    (nodeEnv === "production" ? null : "BlazeAdmin2026!");
  if (!adminPassword) {
    throw new Error(
      "Refusing to seed admin with a default password in production. Set ADMIN_SEED_PASSWORD."
    );
  }
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: "admin@blazeandbun.com" },
    update: {},
    create: {
      name: "Blaze & Bun Admin",
      email: "admin@blazeandbun.com",
      hashedPassword: adminHash,
      role: "admin",
      emailVerified: true,
      isActive: true,
    },
  });
  console.log("  ✓ admin user (admin@blazeandbun.com)");

  // ---- Reviews (approved, linked to first active branch) ----
  const firstBranchId = branchRows[0]?.id;
  if (firstBranchId) {
    const reviewRows = REVIEWS.map((r) => ({
      id: r.id,
      userId: null,
      branchId: firstBranchId,
      rating: r.rating,
      comment: r.text,
      isApproved: true,
      source: "internal" as const,
    }));
    await prisma.review.createMany({ data: reviewRows, skipDuplicates: true });
    console.log(`  ✓ ${reviewRows.length} reviews`);
  }

  // ---- Promo codes (Phase 4: checkout promotions) ----
  const promoTargets: Array<{ code: string; description: string; discountType: "percent" | "fixed"; discountValue: number; maxDiscount?: number; minOrderAmount: number; branchId?: string; usageLimit?: number }> = [
    { code: "WELCOME15", description: "15% off your first blaze (min $20)", discountType: "percent", discountValue: 15, minOrderAmount: 20 },
    { code: "BLAZE10", description: "$10 off orders over $35 — SoHo only", discountType: "fixed", discountValue: 10, minOrderAmount: 35, branchId: "nyc-soho" },
    { code: "NYC50", description: "20% off big SoHo orders (up to $20)", discountType: "percent", discountValue: 20, maxDiscount: 20, minOrderAmount: 50, branchId: "nyc-soho", usageLimit: 500 },
    { code: "LONDONFEAST", description: "£5 off your Shoreditch feast", discountType: "fixed", discountValue: 5, minOrderAmount: 25, branchId: "london-shoreditch" },
  ];
  const now = new Date();
  const promoRows = promoTargets.map((p) => ({
    code: p.code,
    description: p.description,
    discountType: p.discountType,
    discountValue: new Prisma.Decimal(p.discountValue),
    maxDiscount: p.maxDiscount !== undefined ? new Prisma.Decimal(p.maxDiscount) : null,
    minOrderAmount: new Prisma.Decimal(p.minOrderAmount),
    branchId: p.branchId ?? null,
    startsAt: now,
    expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    usageLimit: p.usageLimit ?? null,
    isActive: true,
  }));
  await Promise.all(
    promoRows.map((p) =>
      prisma.promoCode.upsert({
        where: { code: p.code },
        update: p,
        create: p,
      })
    )
  );
  console.log(`  ✓ ${promoRows.length} promo codes`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });