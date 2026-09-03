import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";
import { cached } from "@/lib/cache";

// ---------------------------------------------------------------------------
// Dynamic ETA engine (fast-food kitchen load model).
//
// ETA = base prep + delivery estimate + surge penalty.
//   - Base prep is fixed (kitchen SLAs).
//   - Delivery estimate scales with straight-line distance from the branch,
//     capped at the branch delivery radius (clamped to a sane ceiling).
//   - Surge: when more than `SURGE_THRESHOLD` orders are actively PREPARING at
//     the branch, add `SURGE_PENALTY_MINUTES` (the kitchen is loaded).
// ---------------------------------------------------------------------------

export const BASE_PREP_MINUTES = 15;
export const SURGE_THRESHOLD = 10;
export const SURGE_PENALTY_MINUTES = 10;

/** Distance assumed for delivery when the client provides no coordinates. */
export const ASSUMED_DISTANCE_KM = 5;

const DELIVERY_BASE_MINUTES = 10;
const DELIVERY_PER_KM = 1.2;
const DELIVERY_MAX_MINUTES = 30;
const FALLBACK_RADIUS_KM = 8;

export interface EtaInput {
  deliveryType: "delivery" | "pickup";
  branchLat: number;
  branchLng: number;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  radiusKm?: number | null;
  preparingCount: number;
}

export interface EtaEstimate {
  totalMinutes: number;
  basePrepMinutes: number;
  deliveryMinutes: number;
  surgeMinutes: number;
  surgeApplied: boolean;
  distanceKm: number;
}

/** Compute a delivery ETA (minutes) for a branch + optional destination point. */
export function computeEta(input: EtaInput): EtaEstimate {
  let deliveryMinutes = 0;
  let distanceKm = 0;

  if (input.deliveryType === "delivery") {
    let km = ASSUMED_DISTANCE_KM;
    const hasCoords =
      typeof input.deliveryLat === "number" &&
      Number.isFinite(input.deliveryLat) &&
      typeof input.deliveryLng === "number" &&
      Number.isFinite(input.deliveryLng);
    if (hasCoords) {
      km = haversineKm(
        { lat: input.branchLat, lng: input.branchLng },
        { lat: input.deliveryLat as number, lng: input.deliveryLng as number }
      );
    }
    const radius = input.radiusKm && input.radiusKm > 0 ? input.radiusKm : FALLBACK_RADIUS_KM;
    distanceKm = Math.max(0, Math.min(km, radius));
    deliveryMinutes = Math.round(
      Math.min(DELIVERY_MAX_MINUTES, DELIVERY_BASE_MINUTES + distanceKm * DELIVERY_PER_KM)
    );
  }

  const surgeApplied = input.preparingCount > SURGE_THRESHOLD;
  const surgeMinutes = surgeApplied ? SURGE_PENALTY_MINUTES : 0;
  const totalMinutes = BASE_PREP_MINUTES + deliveryMinutes + surgeMinutes;

  return {
    totalMinutes,
    basePrepMinutes: BASE_PREP_MINUTES,
    deliveryMinutes,
    surgeMinutes,
    surgeApplied,
    distanceKm: Math.round(distanceKm * 100) / 100,
  };
}

/** Seconds left until `createdAt + etaMinutes`. Never negative. */
export function etaRemainingSeconds(
  createdAt: Date | string,
  etaMinutes: number,
  now: Date = new Date()
): number {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const elapsedSec = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 1000));
  return Math.max(0, etaMinutes * 60 - elapsedSec);
}

/** Number of orders currently PREPARING at a branch (the "kitchen load"). */
export async function kitchenLoad(branchId: string): Promise<number> {
  // Short-lived cache so frequent cart/checkout calls don't each run a COUNT.
  return cached(`kitchen:load:${branchId}`, () =>
    prisma.order.count({
      where: { branchId, status: "preparing" },
    }),
    30 * 1000
  );
}