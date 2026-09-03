import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BranchSchedule } from "@/data/branches";
import { branchDtoToLocation, normalizeStoredLocation } from "@/lib/location";
import type { BranchDTO } from "@/lib/location/types";

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  customizations: {
    size?: string;
    bun?: string;
    extras?: string[];
    spiceLevel?: number;
    notes?: string;
    specialInstructions?: string;
  };
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) =>
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) =>
              i.menuItemId === item.menuItemId &&
              JSON.stringify(i.customizations) === JSON.stringify(item.customizations)
          );

          if (existingIndex >= 0) {
            const newItems = [...state.items];
            newItems[existingIndex].quantity += item.quantity;
            return { items: newItems };
          }

          return {
            items: [...state.items, { ...item, id: genId() }],
          };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
          ),
        })),

      clearCart: () => set({ items: [] }),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      getSubtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
    {
      name: "blaze-bun-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export interface UIState {
  isMenuOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMenuOpen: false,
  toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
  closeMenu: () => set({ isMenuOpen: false }),
}));

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  currency: string;
  currencySymbol: string;
  hours: string;
  phone: string;
  coordinates: { lat: number; lng: number };
  isDefault: boolean;
  /** IANA timezone used for operating-hours math (e.g. "America/New_York"). */
  timezone: string;
  /** Structured weekly schedule keyed by day of week. */
  schedule: BranchSchedule;
  /** Live availability snapshot (may be stale by up to a minute). */
  isOpen?: boolean;
  localTime?: string;
  availabilityLabel?: string;
  /** Distance to the user, only present after location detection. */
  distanceKm?: number;
  withinRadius?: boolean;
  deliveryRadiusKm?: number;
  isFeatured?: boolean;
  parking?: string | null;
}

/**
 * Outcome of a geolocation + nearest-branch detection attempt, so the UI can
 * distinguish a success from each failure mode (and show a targeted message).
 */
export type DetectResult =
  | { ok: true; location: Location; address?: string; city?: string }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "permission_denied"
        | "position_unavailable"
        | "timeout"
        | "network"
        | "no_branch";
    };

export interface LocationState {
  locations: Location[];
  selectedLocation: Location | null;
  setSelectedLocation: (location: Location) => void;
  initializeLocation: () => void;
  /**
   * Uses the hardened browser geolocation API (high accuracy, short timeout,
   * automatic retry without high accuracy) to detect and select the nearest
   * branch. Resolves deterministically so the UI never hangs on a spinner.
   */
  detectFromBrowser: () => Promise<DetectResult>;
  /** Select the branch nearest to an explicit lat/lng (used by detect API). */
  detectAt: (lat: number, lng: number) => Promise<DetectResult>;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => {
      const syncCookie = (location: Location) => {
        fetch("/api/location/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId: location.id }),
        }).catch(() => {});
      };

      return {
        locations: [],
        selectedLocation: null,

        setSelectedLocation: (location) => {
          set({ selectedLocation: location });
          syncCookie(location);
        },

        initializeLocation: () => {
          (async () => {
            try {
              const res = await fetch("/api/branches", { cache: "no-store" });
              if (!res.ok) return;
              const data = (await res.json()) as { branches?: BranchDTO[] };
              const dtoList = data.branches ?? [];
              const locations = dtoList.map(branchDtoToLocation);
              set({ locations });

              const current = get().selectedLocation;
              const persisted = current && locations.find((l) => l.id === current.id);
              const cookieSelectedId = dtoList.find((b) => b.isSelected)?.id;
              const preselected = locations.find((l) => l.id === cookieSelectedId);
              const fallback = locations.find((l) => l.isDefault) ?? locations[0];

              const next = persisted ?? preselected ?? fallback ?? null;
              if (next) set({ selectedLocation: next });
            } catch {
              // Keep any last-known state; UI degrades to "Select" if none.
            }
          })();
        },

        detectAt: async (lat, lng) => {
          try {
            const res = await fetch("/api/location/detect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude: lat, longitude: lng }),
            });
            if (!res.ok) {
              const is404 = res.status === 404;
              return is404
                ? { ok: false as const, reason: "no_branch" }
                : { ok: false as const, reason: "network" };
            }
            const data = (await res.json()) as {
              branch?: BranchDTO;
              distanceKm?: number;
              withinRadius?: boolean;
              address?: string;
              city?: string;
            };
            if (!data.branch) {
              return { ok: false as const, reason: "no_branch" };
            }
            const location = branchDtoToLocation(data.branch);
            if (data.distanceKm !== undefined) location.distanceKm = data.distanceKm;
            if (data.withinRadius !== undefined) location.withinRadius = data.withinRadius;
            set({ selectedLocation: location });
            syncCookie(location);
            return {
              ok: true as const,
              location,
              address: data.address,
              city: data.city,
            };
          } catch {
            return { ok: false as const, reason: "network" };
          }
        },

        detectFromBrowser: () => {
          const { detectAt } = get();
          return new Promise<DetectResult>((resolve) => {
            if (
              typeof navigator === "undefined" ||
              typeof navigator.geolocation === "undefined"
            ) {
              resolve({ ok: false, reason: "unsupported" });
              return;
            }

            // Attempt #1: high accuracy, no cache, short timeout.
            const attempt = (highAccuracy: boolean, onError: (code: number) => void) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  resolve(detectAt(pos.coords.latitude, pos.coords.longitude));
                },
                (err) => onError(err.code),
                {
                  enableHighAccuracy: highAccuracy,
                  timeout: 10000,
                  maximumAge: 0,
                }
              );
            };

            // Attempt #2 (fallback): drop high accuracy once, then give up.
            attempt(true, (code) => {
              if (code === 1) {
                // Permission denied — retrying won't help, surface immediately.
                resolve({ ok: false, reason: "permission_denied" });
                return;
              }
              // Position unavailable (2) or timeout (3): retry without high accuracy.
              attempt(false, (_code2) => {
                resolve({
                  ok: false,
                  reason: _code2 === 3 ? "timeout" : "position_unavailable",
                });
              });
            });
          });
        },
      };
    },
    {
      name: "blaze-bun-location",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedLocation: state.selectedLocation }),
      merge: (persisted, current) => {
        const p = persisted as Partial<LocationState> | undefined;
        if (!p?.selectedLocation) return current;
        const normalized = normalizeStoredLocation(p.selectedLocation);
        return { ...current, selectedLocation: normalized };
      },
    }
  )
);

export interface SavedAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postal: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: "customer" | "staff" | "admin";
  emailVerified?: boolean;
}

export interface Order {
  id: string;
  date: string;
  total: number;
  currency: string;
  items: CartItem[];
  status: string;
  address?: string;
  notes?: string;
}

export interface AuthState {
  user: User | null;
  isOpen: boolean;
  status: "idle" | "loading" | "authenticated";
  addresses: SavedAddress[];
  orders: Order[];
  error: string | null;
  openAuth: () => void;
  closeAuth: () => void;
  toggleAuth: () => void;
  signIn: (input: { email: string; password: string }) => Promise<string | null>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<string | null>;
  clearError: () => void;
  hydrateUser: () => Promise<void>;
  signOut: () => Promise<void>;
  addAddress: (addr: Omit<SavedAddress, 'id'>) => void;
  removeAddress: (id: string) => void;
  addOrder: (
    total: number,
    items: CartItem[],
    currency?: string,
    meta?: { address?: string; notes?: string }
  ) => string;
  updateOrderStatus: (id: string, status: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isOpen: false,
      status: "idle",
      addresses: [],
      orders: [],
      error: null,
      openAuth: () => set({ isOpen: true }),
      closeAuth: () => set({ isOpen: false }),
      toggleAuth: () => set((s) => ({ isOpen: !s.isOpen })),
      signIn: async (input) => {
        set({ status: "loading", error: null });
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            set({ status: "idle", error: (data as { error?: string }).error ?? "Login failed" });
            return (data as { error?: string }).error ?? "Login failed";
          }
          set({ user: (data as { user: User }).user, status: "authenticated", isOpen: false, error: null });
          return null;
        } catch {
          set({ status: "idle", error: "Network error during login." });
          return "Network error during login.";
        }
      },
      signUp: async (input) => {
        set({ status: "loading", error: null });
        try {
          const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            set({ status: "idle", error: (data as { error?: string }).error ?? "Signup failed" });
            return (data as { error?: string }).error ?? "Signup failed";
          }
          set({ user: (data as { user: User }).user, status: "authenticated", isOpen: false, error: null });
          return null;
        } catch {
          set({ status: "idle", error: "Network error during signup." });
          return "Network error during signup.";
        }
      },
      hydrateUser: async () => {
        try {
          const res = await fetch("/api/auth/me", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            set({ user: (data as { user: User }).user, status: "authenticated", error: null });
          } else {
            set({ user: null, status: "idle" });
          }
        } catch {
          set({ status: "idle" });
        }
      },
      signOut: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          set({ user: null, status: "idle", error: null });
        }
      },
      clearError: () => set({ error: null }),
      addAddress: (addr) =>
        set((s) => ({ addresses: [...s.addresses, { ...addr, id: genId() }] })),
      removeAddress: (id) =>
        set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) })),
      addOrder: (total, items, currency = 'USD', meta) => {
        const id = `BB-${Math.floor(100000 + Math.random() * 900000)}`;
        set((s) => ({
          orders: [
            {
              id,
              date: new Date().toLocaleString(),
              total,
              currency,
              items,
              status: 'confirmed',
              address: meta?.address,
              notes: meta?.notes,
            },
            ...s.orders,
          ],
        }));
        return id;
      },
      updateOrderStatus: (id, status) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })),
    }),
    {
      name: "blaze-bun-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        addresses: state.addresses,
        orders: state.orders,
      }),
    }
  )
);