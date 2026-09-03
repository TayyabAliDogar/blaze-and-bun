"use client";
import { useEffect, useState } from "react";
import { getBranchStatus, parseSchedule } from "@/lib/location/availability";
import type { AvailabilitySnapshot } from "@/lib/location/availability";
import { CLIENT_FORCE_BRANCHES_OPEN } from "@/lib/location/ordering";
import type { Location } from "@/store";

const REFRESH_MS = 60_000;

/**
 * Live availability for a branch, recomputed every 60s so the UI flips to
 * closed at the exact operating-hours boundary without a server round-trip.
 * Falls back to the server snapshot stored on the location while unknown.
 */
export function useBranchAvailability(location: Location | null): AvailabilitySnapshot | null {
  const [snapshot, setSnapshot] = useState<AvailabilitySnapshot | null>(null);

  useEffect(() => {
    if (!location) return;
    const compute = () => {
      try {
        const schedule = parseSchedule(location.schedule);
        setSnapshot(getBranchStatus(schedule, location.timezone || "UTC", new Date()));
      } catch {
        // Degrade to the server-provided fields instead of throwing.
        setSnapshot({
          isOpen: location.isOpen ?? true,
          localTime: location.localTime ?? "",
          nextTransition: null,
          label: location.availabilityLabel ?? "",
        });
      }
    };
    compute();
    const timer = setInterval(compute, REFRESH_MS);
    return () => clearInterval(timer);
  }, [location]);

  // No location selected: consumers fall back to `location?.isOpen`.
  if (!location) return null;

  return snapshot;
}

/** Convenience: just the boolean open state (defaults true while unknown). */
export function useBranchIsOpen(location: Location | null): boolean {
  const snapshot = useBranchAvailability(location);
  const realOpen = snapshot?.isOpen ?? location?.isOpen ?? true;
  return CLIENT_FORCE_BRANCHES_OPEN || realOpen;
}