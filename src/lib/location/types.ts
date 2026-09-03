import type { BranchSchedule, Weekday } from "@/data/branches";

export type { Weekday };

/** Wire shape returned by the API — never constructed in client components. */
export interface BranchDTO {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  currencyCode: string;
  currencySymbol: string;
  lat: number;
  lng: number;
  phone: string | null;
  timezone: string;
  openingHours: string;
  schedule: BranchSchedule;
  deliveryRadiusKm: number;
  isDefault: boolean;
  isFeatured: boolean;
  parking: string | null;
  isActive: boolean;
  isOpen: boolean;
  localTime: string;
  nextTransition: string | null;
  availabilityLabel: string;
  isSelected: boolean;
  /** Present only on /api/location/detect responses. */
  distanceKm?: number;
  withinRadius?: boolean;
}