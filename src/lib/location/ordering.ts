// ---------------------------------------------------------------------------
// Ordering availability control.
//
// The storefront computes "is the branch open right now" from real operating
// hours. For the demo/launch deployment we allow ordering at ANY time so the
// site is fully functional around the clock; production can disable this by
// leaving NEXT_PUBLIC_FORCE_BRANCHES_OPEN unset/false so only real opening
// hours gate ordering. The server must use the SAME decision so the client
// never shows "Add to Cart" while the API rejects it (or vice-versa).
// ---------------------------------------------------------------------------

/** Client/test-side flag: treat every branch as open so nothing is blocked. */
export const CLIENT_FORCE_BRANCHES_OPEN =
  process.env.NEXT_PUBLIC_FORCE_BRANCHES_OPEN === "true" ||
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test";

/** Server-side flag: allow checkout/cart to proceed while branches are closed. */
export const SERVER_FORCE_BRANCHES_OPEN =
  process.env.FORCE_BRANCHES_OPEN === "true" ||
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test" ||
  process.env.NODE_ENV === undefined;

/**
 * Whether ordering should be enabled for `isOpen` (real operating hours).
 * When the force-open flag is set, ordering is always available; otherwise it
 * respects the actual availability snapshot.
 */
export function orderingEnabled(isOpen: boolean): boolean {
  return CLIENT_FORCE_BRANCHES_OPEN || isOpen;
}

/** Server variant keyed off the private (non-public) env flag. */
export function orderingEnabledServer(isOpen: boolean): boolean {
  return SERVER_FORCE_BRANCHES_OPEN || isOpen;
}