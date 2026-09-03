"use client";
import { useEffect, useState } from "react";
import { useLocationStore } from "@/store";
import type { BranchDTO } from "@/lib/location/types";

export interface BranchMenu {
  branch: Pick<
    BranchDTO,
    "id" | "name" | "city" | "currencyCode" | "currencySymbol" | "isOpen"
  >;
  currencyCode: string;
  currencySymbol: string;
  basedOnCookie: boolean;
  /** Price by menu item id, resolved per selected branch (fallback = default branch). */
  priceMap: Record<string, number>;
  /** Rich item list keyed by category id (same shape as /api/menu). */
  categories: {
    id: string;
    name: string;
    displayOrder: number;
    items: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      categoryId: string;
      price: number;
      isOutOfStock: boolean;
    }[];
  }[];
}

/**
 * Fetch /api/menu scoped to the selected branch (falling back to the default
 * branch server-side when no branch cookie exists yet). Refetches whenever the
 * selected branch changes. The static MENU_ITEMS catalog stays the source of
 * merchandising metadata; displayed prices come from here.
 */
export function useBranchMenu() {
  const branchId = useLocationStore((s) => s.selectedLocation?.id);
  const [menu, setMenu] = useState<BranchMenu | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;

    // Kick off the fetch on the next tick so the loading/error state changes
    // happen outside the synchronous effect body (avoids cascading renders).
    const t = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      fetch("/api/menu", { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Menu request failed (${res.status})`);
          const data = (await res.json()) as BranchMenu;
          if (!cancelled) setMenu(data);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load menu");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [branchId]);

  return { menu, loading, error };
}