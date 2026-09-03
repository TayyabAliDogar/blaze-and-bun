import type { OrderStatus, StatusChangeSource } from "@/generated/prisma/client";

/**
 * Admin order state machine.
 *
 * The DB enum: pending → received → preparing → ready → completed / cancelled.
 * Admin UI labels map the "out for delivery" / "delivered" concepts onto these
 * states:
 *   - pending      = Received (new order, awaiting acceptance)
 *   - received     = Accepted / In Kitchen
 *   - preparing    = Preparing
 *   - ready        = Ready / Out for Delivery
 *   - completed    = Delivered / Completed
 *   - cancelled    = Cancelled
 *
 * Only the transitions below are legal. Violations are rejected client + server
 * side, and every successful move writes an OrderStatusLog + AdminAuditLog.
 */

export interface StatusLabel {
  /** Short UI label. */
  label: string;
  /** Tailwind badge class for the kanban/table. */
  badge: string;
  /** Ring color for grouping columns. */
  ring: string;
}

export const STATUS_LABELS: Record<OrderStatus, StatusLabel> = {
  pending: { label: "Received", badge: "bg-[#3D8B40]/20 text-[#5FB96A] border-[#3D8B40]/40", ring: "border-[#3D8B40]/40" },
  received: { label: "In Kitchen", badge: "bg-[#F2B33D]/20 text-[#F2B33D] border-[#F2B33D]/40", ring: "border-[#F2B33D]/40" },
  preparing: { label: "Preparing", badge: "bg-[#F29C3D]/20 text-[#FFC078] border-[#F29C3D]/40", ring: "border-[#F29C3D]/40" },
  ready: { label: "Ready", badge: "bg-[#8A7FB8]/20 text-[#B9AEF0] border-[#8A7FB8]/40", ring: "border-[#8A7FB8]/40" },
  completed: { label: "Delivered", badge: "bg-white/10 text-[#8A7F72] border-white/10", ring: "border-white/10" },
  cancelled: { label: "Cancelled", badge: "bg-[#E8542A]/20 text-[#E8542A] border-[#E8542A]/40", ring: "border-[#E8542A]/40" },
};

/** Legal forward transitions (excluding cancel which is handled separately). */
const FORWARD: Record<OrderStatus, OrderStatus[]> = {
  pending: ["received", "cancelled"],
  received: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Every status may be moved backward one step (correction), e.g. for staff error. */
const BACKWARD: Record<OrderStatus, OrderStatus[]> = {
  pending: [],
  received: ["pending"],
  preparing: ["received"],
  ready: ["preparing"],
  completed: ["ready"],
  cancelled: [],
};

export type Transition = {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  source: StatusChangeSource;
  note?: string | null;
};

/** All statuses a given status can transition to (forward + backward), excluding itself. */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  const set = new Set<OrderStatus>([...FORWARD[from], ...BACKWARD[from]]);
  set.delete(from);
  return [...set];
}

/** Validate a transition. Returns an error string, or null when legal. */
export function validateTransition(from: OrderStatus, to: OrderStatus): string | null {
  if (from === to) return "Order already in that status.";
  if (from === "cancelled" || from === "completed") {
    return "This order is final and can no longer be changed.";
  }
  if (FORWARD[from].includes(to) || BACKWARD[from].includes(to)) {
    return null;
  }
  return "That status change is not allowed for this order.";
}

export type { OrderStatus };
