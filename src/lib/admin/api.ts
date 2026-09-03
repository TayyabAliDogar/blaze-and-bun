// Shared client types for the /admin/* dashboard (mirrors the API responses).

export type Role = "customer" | "staff" | "admin";

export interface AdminOrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: string;
  customizationSnapshotJson: Record<string, unknown> | null;
}

export interface AdminOrder {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  deliveryType: string;
  subtotal: string;
  deliveryFee: string;
  tax: string;
  discount: string;
  total: string;
  currencyCode: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  etaMinutes: number | null;
  createdAt: string;
  branch: { id: string; name: string; city: string } | null;
  user: { id: string; name: string; email: string } | null;
  items: AdminOrderItem[];
}

export interface AdminOrderListResponse {
  ok: boolean;
  orders: AdminOrder[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
}

export interface AnalyticsTopItem {
  menuItemId: string;
  name: string;
  branchId: string;
  branchName: string;
  quantity: number;
  revenue: number;
}

export interface AnalyticsBranch {
  id: string;
  name: string;
  city: string;
  currencyCode: string;
  isActive: boolean;
  revenue: number;
  orders: number;
}

export interface AnalyticsResponse {
  ok: boolean;
  totals: { revenue: number; orders: number; avgOrderValue: number };
  today: { orders: number; revenue: number };
  statusBreakdown: Record<string, number>;
  topByBranch: Record<string, AnalyticsTopItem[]>;
  branches: AnalyticsBranch[];
  generatedAt: string;
}

export interface AdminBranchSummary {
  id: string;
  name: string;
  city: string;
  country: string;
  currencyCode: string;
  isActive: boolean;
}

export interface AdminMenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  prices: Record<string, number>;
  /** Branch ids where this item is currently out of stock. */
  outOfStockBranches: string[];
}

export interface AdminMenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  items: AdminMenuItem[];
}

export interface AdminMenuResponse {
  ok: boolean;
  branches: AdminBranchSummary[];
  categories: AdminMenuCategory[];
}

export interface AdminBranchDetail {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  currencyCode: string;
  phone: string | null;
  timezone: string;
  openingHours: string;
  schedule: unknown;
  deliveryRadiusKm: number;
  isDefault: boolean;
  isFeatured: boolean;
  parking: string | null;
  isActive: boolean;
  lat: number;
  lng: number;
  createdAt: string;
}

export interface AdminBranchDetailResponse {
  ok: boolean;
  branch: AdminBranchDetail;
}

export interface AdminBranchListResponse {
  ok: boolean;
  branches: (AdminBranchDetail & { currencySymbol: string })[];
}

export interface AdminPromo {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  minOrderAmount: number;
  branchId: string | null;
  branch: { id: string; name: string; city: string } | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  isExpired: boolean;
  startsInFuture: boolean;
  usagePercent: number | null;
  createdAt: string;
}

export interface AdminPromoListResponse {
  ok: boolean;
  promos: AdminPromo[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
}

export interface AdminUserListResponse {
  ok: boolean;
  users: AdminUser[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  source: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
  branch: { id: string; name: string; city: string };
  orderId: string | null;
}

export interface AdminReviewListResponse {
  ok: boolean;
  reviews: AdminReview[];
  counts: { approved: number; pending: number; total: number };
  pagination: { page: number; limit: number; total: number; pages: number };
}

const jsonHeaders = { "Content-Type": "application/json" };

export async function adminJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...jsonHeaders, ...(init?.headers ?? {}) },
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data;
}
