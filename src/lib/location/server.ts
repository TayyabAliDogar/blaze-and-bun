import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";
import { getBranchStatus, parseSchedule } from "@/lib/location/availability";
import type { BranchDTO } from "@/lib/location/types";
import { BRANCH_COOKIE, BRANCH_MAX_AGE, cookieSecure } from "@/lib/auth/constants";
import { cached } from "@/lib/cache";
import type { Branch } from "@/generated/prisma/client";

export const CYR = {
  USD: "$",
  GBP: "£",
  EUR: "€",
} as const;

export function currencySymbol(code: string | null): string {
  const c = (code ?? "USD").toUpperCase();
  return CYR[c as keyof typeof CYR] ?? "$";
}

/** Build the public branch DTO. `at` lets tests fix the clock; defaults to now. */
export function toBranchDTO(branch: Branch, opts?: { at?: Date; isSelected?: boolean }): BranchDTO {
  const at = opts?.at ?? new Date();
  const schedule = parseSchedule(branch.schedule);
  const status = getBranchStatus(schedule, branch.timezone || "UTC", at);
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    city: branch.city,
    country: branch.country,
    currencyCode: branch.currencyCode,
    currencySymbol: currencySymbol(branch.currencyCode),
    lat: branch.lat,
    lng: branch.lng,
    phone: branch.phone,
    timezone: branch.timezone,
    openingHours: branch.openingHours,
    schedule,
    deliveryRadiusKm: branch.deliveryRadiusKm ?? 8,
    isDefault: branch.isDefault,
    isFeatured: branch.isFeatured,
    parking: branch.parking,
    isActive: branch.isActive,
    isOpen: status.isOpen,
    localTime: status.localTime,
    nextTransition: status.nextTransition,
    availabilityLabel: status.label,
    isSelected: Boolean(opts?.isSelected),
  };
}

/** All active branches, ordered by creation (stable across requests). */
export async function getActiveBranches(): Promise<Branch[]> {
  return cached("branches:active", () =>
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    5 * 60 * 1000 // 5 min; invalidated by admin branch edits
  );
}

/** The default "main" branch: the row flagged isDefault, else the first active. */
export async function getDefaultBranch(): Promise<Branch | null> {
  return cached("branches:default", () => {
    const fallbackPromise = prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return fallbackPromise.then(async (fallback) => {
      if (!fallback) return null;
      if (fallback.isDefault) return fallback;
      const flagged = await prisma.branch.findFirst({
        where: { isActive: true, isDefault: true },
      });
      return flagged ?? fallback;
    });
  }, 5 * 60 * 1000);
}

export function readBranchId(req: NextRequest): string | null {
  return req.cookies.get(BRANCH_COOKIE)?.value ?? null;
}

export function setBranchCookie(res: NextResponse, branchId: string): void {
  res.cookies.set(BRANCH_COOKIE, branchId, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: BRANCH_MAX_AGE,
  });
}

/** Resolve the selected branch (cookie → branch row) falling back to default. */
export async function resolveBranch(req: NextRequest): Promise<{ branch: Branch; fromCookie: boolean }> {
  const wanted = readBranchId(req);
  if (wanted) {
    const found = await prisma.branch.findUnique({
      where: { id: wanted },
    });
    if (found && found.isActive) return { branch: found, fromCookie: true };
  }
  const fallback = await getDefaultBranch();
  if (!fallback) throw new Error("NO_ACTIVE_BRANCHES");
  return { branch: fallback, fromCookie: false };
}

/**
 * Nearest branch to a point (by haversine) among active branches.
 * Returns the full branch row plus the distance in km.
 */
export async function nearestBranch(lat: number, lng: number): Promise<{
  branch: Branch;
  distanceKm: number;
  withinRadius: boolean;
} | null> {
  const branches = await getActiveBranches();
  let best: { branch: Branch; distanceKm: number } | null = null;
  for (const b of branches) {
    const d = haversineKm({ lat, lng }, { lat: b.lat, lng: b.lng });
    if (!best || d < best.distanceKm) best = { branch: b, distanceKm: d };
  }
  if (!best) return null;
  return {
    branch: best.branch,
    distanceKm: best.distanceKm,
    withinRadius: best.distanceKm <= (best.branch.deliveryRadiusKm ?? 8),
  };
}