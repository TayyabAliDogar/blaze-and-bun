import type { BranchDTO } from '@/lib/location/types';
import type { BranchSchedule } from '@/data/branches';
import type { Location } from '@/store';

const EMPTY_SCHEDULE: BranchSchedule = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

/** Whether a branch operates in GBP (UK). Everything else is USD. */
export function isUKBranch(branch: Pick<BranchDTO, 'city' | 'phone' | 'currencyCode'>): boolean {
  return (
    branch.currencyCode?.toUpperCase() === 'GBP' ||
    branch.city.toLowerCase().includes('london') ||
    branch.phone?.startsWith('+44') === true
  );
}

/** Convert an API branch DTO into the persisted store Location shape. */
export function branchDtoToLocation(b: BranchDTO): Location {
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city.split(',')[0],
    currency: b.currencyCode,
    currencySymbol: b.currencySymbol,
    hours: b.openingHours,
    phone: b.phone ?? '',
    coordinates: { lat: b.lat, lng: b.lng },
    isDefault: b.isDefault,
    timezone: b.timezone,
    schedule: b.schedule,
    isOpen: b.isOpen,
    localTime: b.localTime,
    availabilityLabel: b.availabilityLabel,
    deliveryRadiusKm: b.deliveryRadiusKm,
    isFeatured: b.isFeatured,
    parking: b.parking,
  };
}

/** Keep old JSON persisted in localStorage alive: default optional fields. */
export function normalizeStoredLocation(loc: Partial<Location> & { id: string }): Location | null {
  if (!loc.id) return null;
  return {
    id: loc.id,
    name: loc.name ?? '',
    address: loc.address ?? '',
    city: loc.city ?? '',
    currency: loc.currency ?? 'USD',
    currencySymbol: loc.currencySymbol ?? '$',
    hours: loc.hours ?? '',
    phone: loc.phone ?? '',
    coordinates: loc.coordinates ?? { lat: 0, lng: 0 },
    isDefault: loc.isDefault ?? false,
    timezone: loc.timezone ?? 'UTC',
    schedule: loc.schedule ?? EMPTY_SCHEDULE,
    isOpen: loc.isOpen,
    localTime: loc.localTime,
    availabilityLabel: loc.availabilityLabel,
    deliveryRadiusKm: loc.deliveryRadiusKm,
    isFeatured: loc.isFeatured,
    parking: loc.parking,
  };
}