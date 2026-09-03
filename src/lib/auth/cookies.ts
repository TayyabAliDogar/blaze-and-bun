import type { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  GUEST_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
  GUEST_MAX_AGE,
  cookieSecure,
} from "./constants";

export function setAuthCookies(
  res: NextResponse,
  access: string,
  refresh: string
): NextResponse {
  res.cookies.set({
    name: ACCESS_COOKIE,
    value: access,
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: refresh,
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/api/auth",
    maxAge: REFRESH_MAX_AGE,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set({
    name: ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: "",
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0,
  });
  return res;
}

export function setGuestCookie(res: NextResponse, guestId: string): NextResponse {
  res.cookies.set({
    name: GUEST_COOKIE,
    value: guestId,
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: GUEST_MAX_AGE,
  });
  return res;
}

export function clientIp(req: Request): string | null {
  // Prefer the peer IP set by a trusted proxy/gateway (Vercel, Cloudflare,
  // nginx). When absent, use the LAST hop of X-Forwarded-For, which is the
  // closest (least spoofable) value when the header is attacker-controlled.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  }
  return null;
}