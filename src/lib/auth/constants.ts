// Auth cookie/session constants. Shared by API routes (Node) and middleware (Edge).
// NEVER expose these to client bundles — they are server-only concerns.

export const ACCESS_COOKIE = "blaze_access";
export const REFRESH_COOKIE = "blaze_refresh";
export const GUEST_COOKIE = "blaze_guest";
export const BRANCH_COOKIE = "blaze_branch";

export const ACCESS_MAX_AGE = 15 * 60; // 15 min
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
export const GUEST_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
export const BRANCH_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
export const LOGIN_RATE_LIMIT_MAX = 5; // attempts per IP

export const cookieSecure = () => process.env.NODE_ENV === "production";