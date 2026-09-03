import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nearestBranch, toBranchDTO } from "@/lib/location/server";
import { apiError } from "@/lib/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const detectSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    postalCode: z.string().trim().min(2).max(20).optional(),
  })
  .refine((v) => (v.latitude !== undefined && v.longitude !== undefined) || v.postalCode, {
    message: "Provide latitude+longitude or a postal code",
  })
  .refine(
    (v) => !((v.latitude !== undefined) !== (v.longitude !== undefined)),
    { message: "Both latitude and longitude are required together" }
  );

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
}

interface ReverseGeocodeResult {
  address: string;
  city: string;
}

/**
 * Best-effort postal → coordinates geocoding via OpenStreetMap Nominatim.
 * Public instance, no key required. Fails soft (returns null) so callers can
 * fall back to a friendly message instead of crashing.
 */
async function geocodePostalCode(postalCode: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    postalcode: postalCode,
    countrycodes: "us,gb",
    addressdetails: "0",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "blaze-and-bun/1.0 (demo)" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult[];
    const first = data[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reverse-geocode a lat/lng into a human-readable address + city.
 *
 * Tries Google Maps Geocoding API first (when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * is set), then falls back to OpenStreetMap Nominatim (key-free). Both fail
 * soft (return null) so the nearest-branch selection still succeeds without an
 * address.
 */
async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (googleKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as {
          status?: string;
          results?: Array<{ formatted_address?: string; address_components?: Array<{ long_name: string; types: string[] }> }>;
        };
        if (data.status === "OK" && data.results?.length) {
          const top = data.results[0];
          const comp = top.address_components ?? [];
          const cityComp =
            comp.find((c) => c.types.includes("locality")) ??
            comp.find((c) => c.types.includes("postal_town")) ??
            comp.find((c) => c.types.includes("administrative_area_level_2"));
          return {
            address: top.formatted_address ?? "",
            city: cityComp?.long_name ?? "",
          };
        }
      }
    } catch {
      // fall through to Nominatim
    }
  }

  // Fallback: OpenStreetMap Nominatim reverse geocoding (no key required).
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { Accept: "application/json", "User-Agent": "blaze-and-bun/1.0 (demo)" }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as {
        display_name?: string;
        address?: { city?: string; town?: string; village?: string; suburb?: string; state?: string };
      };
      const addr = data.address ?? {};
      return {
        address: data.display_name ?? "",
        city: addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? addr.state ?? "",
      };
    }
  } catch {
    // no address — selection can still proceed
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = detectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
  }

  let lat: number;
  let lng: number;
  if (parsed.data.postalCode) {
    const geo = await geocodePostalCode(parsed.data.postalCode);
    if (!geo) {
      return apiError(
        422,
        "Couldn't locate that postal code. Try a different one or use your location.",
        "GEOCODE_FAILED"
      );
    }
    lat = geo.lat;
    lng = geo.lng;
  } else {
    lat = parsed.data.latitude!;
    lng = parsed.data.longitude!;
  }

  const nearest = await nearestBranch(lat, lng);
  if (!nearest) {
    return apiError(404, "No branches are currently available", "NO_BRANCHES");
  }

  // Reverse-geocode the user's position into a human-readable address + city so
  // the UI can show e.g. "Lahore, Pakistan". Best-effort: still succeeds without.
  const geo = await reverseGeocode(lat, lng);

  return NextResponse.json({
    ok: true,
    requested: { latitude: lat, longitude: lng },
    branch: toBranchDTO(nearest.branch, { isSelected: false }),
    distanceKm: Math.round(nearest.distanceKm * 100) / 100,
    withinRadius: nearest.withinRadius,
    deliveryRadiusKm: nearest.branch.deliveryRadiusKm,
    address: geo?.address,
    city: geo?.city,
  });
}