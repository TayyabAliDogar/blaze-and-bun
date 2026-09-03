"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { adminJson, type AdminOrder, type AdminOrderListResponse } from "@/lib/admin/api";
import { STATUS_LABELS, nextStatuses, type OrderStatus } from "@/lib/admin/orderStateMachine";

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "received",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

const PAY_LABELS: Record<string, string> = {
  card: "Card",
  googlepay: "Google Pay",
  applepay: "Apple Pay",
  cod: "Cash on Delivery",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("pending");
  const [q, setQ] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [flash, setFlash] = useState<{ orderId: string; to: string } | null>(null);
  const [busyFor, setBusyFor] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (filter !== "all") params.set("status", filter);
    if (q.trim()) params.set("q", q.trim());
    if (branchFilter) params.set("branch", branchFilter);
    try {
      const data = await adminJson<AdminOrderListResponse>(`/api/admin/orders?${params}`);
      setOrders(data.orders);
      setTotal(data.pagination.total);
      setError(null);
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [filter, q, branchFilter]);

  // Load branches for the filter (from analytics endpoint or a light call).
  const loadBranches = useCallback(async () => {
    try {
      const data = await adminJson<{ ok: boolean; branches: { id: string; name: string }[] }>(
        "/api/admin/analytics"
      );
      setBranches((data.branches ?? []).map((b) => ({ id: b.id, name: b.name })));
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      load();
      loadBranches();
    }, 0);
    return () => clearTimeout(t);
  }, [load, loadBranches]);

  // Optimized polling: refresh every 8s.
  useEffect(() => {
    const id = setInterval(() => load(true), 8000);
    return () => clearInterval(id);
  }, [load]);

  const updateStatus = async (orderId: string, to: OrderStatus) => {
    if (busyFor) return;
    setBusyFor(orderId);
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: to }),
      });
      setFlash({ orderId, to });
      setTimeout(() => setFlash(null), 1500);
      await load(true);
      setSelected((prev) => (prev && prev.id === orderId ? { ...prev, status: to } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyFor(null);
    }
  };

  const kanban = useMemo(() => {
    if (filter !== "all") {
      return { columns: [filter] as OrderStatus[], map: { [filter]: orders } };
    }
    const map: Record<string, AdminOrder[]> = {};
    for (const s of ORDER_STATUSES) map[s] = [];
    for (const o of orders) {
      if (map[o.status]) map[o.status].push(o);
    }
    return { columns: ORDER_STATUSES, map };
  }, [orders, filter]);

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const fmt = (n: number) => formatter.format(n);

  const availableStatuses = useMemo(
    () => (selected ? nextStatuses(selected.status as OrderStatus) : []),
    [selected]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Order Management</h1>
          <p className="text-sm text-[#8A7F72] mt-1">
            {total} orders · live view refreshing every 8s
            {loading && <span className="text-[#F2B33D]"> · loading…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name / email / order id"
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#E8542A]"
          />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-4 py-2 rounded-lg bg-[#1C120C] border border-white/10 text-sm text-[#F5EFE4] focus:outline-none"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", ...ORDER_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s as OrderStatus | "all")}
            className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${
              filter === s
                ? "bg-[#E8542A] text-[#F5EFE4]"
                : "bg-white/5 text-[#8A7F72] hover:text-[#F5EFE4]"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABELS[s as OrderStatus].label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#E8542A]/15 border border-[#E8542A]/40 text-sm">
          {error}
        </div>
      )}

      {/* Kanban / table */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${kanban.columns.length}, minmax(0,1fr))` }}>
        {kanban.columns.map((status) => {
          const list = kanban.map[status] ?? [];
          return (
            <div key={status} className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-medium">{STATUS_LABELS[status].label}</span>
                <span className="text-xs text-[#8A7F72]">{list.length}</span>
              </div>
              <div className="space-y-3">
                {list.length === 0 && (
                  <p className="text-xs text-[#5B534A] text-center py-6">No orders</p>
                )}
                {list.map((o) => (
                  <motion.button
                    key={o.id}
                    layout
                    onClick={() => setSelected(o)}
                    className={`w-full text-left p-3 rounded-xl border bg-[#1C120C]/60 transition-colors hover:bg-[#1C120C] ${STATUS_LABELS[o.status as OrderStatus].ring}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-[#F2B33D] truncate">#{o.id.slice(-6).toUpperCase()}</span>
                      {flash?.orderId === o.id && <span className="text-[#3D8B40] text-xs">✓ {flash.to}</span>}
                    </div>
                    <p className="text-sm mt-2">
                      {(o.guestName ?? o.user?.name ?? o.guestEmail ?? "Guest").split(" ")[0]}
                    </p>
                    <p className="text-[#8A7F72] text-xs mt-0.5">
                      {o.items.reduce((n, i) => n + i.quantity, 0)} items · {o.branch?.name ?? "—"}
                    </p>
                    <p className="font-mono text-sm text-white/90 mt-1.5">{fmt(Number(o.total))}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              className="bg-[#1C120C] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-display text-2xl">Order #{selected.id.slice(-6).toUpperCase()}</h2>
                  <p className="text-xs text-[#8A7F72] mt-1">
                    {new Date(selected.createdAt).toLocaleString()} · {selected.branch?.name} ·{" "}
                    {PAY_LABELS[selected.paymentMethod ?? ""] ?? selected.paymentMethod} ·{" "}
                    <span className={selected.paymentStatus === "paid" ? "text-[#3D8B40]" : "text-[#E8542A]"}>
                      {selected.paymentStatus}
                    </span>
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-[#8A7F72] hover:text-white text-xl px-2">
                  ×
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-[#8A7F72] mb-1">Customer</p>
                  <p className="text-sm">{selected.guestName ?? selected.user?.name ?? "Guest"}</p>
                  <p className="text-xs text-[#8A7F72]">{selected.guestEmail ?? selected.user?.email}</p>
                  <p className="text-xs text-[#8A7F72]">{selected.guestPhone ?? "—"}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-[#8A7F72] mb-1">Delivery</p>
                  <p className="text-xs">{selected.deliveryAddress ?? "Pickup"}</p>
                  {selected.deliveryNotes && <p className="text-xs text-[#8A7F72] mt-1">Note: {selected.deliveryNotes}</p>}
                </div>
              </div>

              <p className="text-[11px] font-mono uppercase tracking-widest text-[#8A7F72] mb-2">Line items</p>
              <div className="space-y-2 mb-5">
                {selected.items.map((it) => (
                  <div key={it.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between text-sm">
                      <span>
                        {it.quantity} × <span className="text-white/90">{it.menuItemId.replace(/-/g, " ")}</span>
                      </span>
                      <span className="font-mono text-[#F2B33D]">
                        {fmt(Number(it.unitPrice) * it.quantity)}
                      </span>
                    </div>
                    {it.customizationSnapshotJson && Object.keys(it.customizationSnapshotJson).length > 0 && (
                      <div className="mt-1.5 text-xs text-[#8A7F72]">
                        {Object.entries(it.customizationSnapshotJson).map(([k, v]) => {
                          let val = typeof v === "string" ? v : JSON.stringify(v ?? "");
                          if (val.startsWith('"')) val = val.slice(1, -1);
                          if (val === "null") val = "—";
                          if (k === "notes" && !val) return null;
                          const isDietary =
                            k === "specialInstructions" || k === "notes" || k === "allergies";
                          return (
                            <div key={k} className="flex gap-2">
                              <span className={`capitalize ${isDietary ? 'text-[#E8542A]' : 'text-[#5B534A]'}`}>
                                {k}:
                              </span>
                              <span className={isDietary ? 'text-[#FFC078]' : ''}>{val.replace(/[\[\]"]/g, "")}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-3 text-sm space-y-1 mb-5">
                <div className="flex justify-between"><span className="text-[#8A7F72]">Subtotal</span><span className="font-mono">{fmt(Number(selected.subtotal))}</span></div>
                <div className="flex justify-between"><span className="text-[#8A7F72]">Delivery</span><span className="font-mono">{fmt(Number(selected.deliveryFee))}</span></div>
                <div className="flex justify-between"><span className="text-[#8A7F72]">Tax</span><span className="font-mono">{fmt(Number(selected.tax))}</span></div>
                {Number(selected.discount) > 0 && (
                  <div className="flex justify-between text-[#3D8B40]"><span>Discount</span><span className="font-mono">−{fmt(Number(selected.discount))}</span></div>
                )}
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="font-mono text-[#F2B33D]">{fmt(Number(selected.total))}</span></div>
              </div>

              <p className="text-[11px] font-mono uppercase tracking-widest text-[#8A7F72] mb-2">Update status</p>
              <div className="flex flex-wrap gap-2">
                {availableStatuses.length === 0 && (
                  <p className="text-xs text-[#8A7F72] py-2">This order is final.</p>
                )}
                {availableStatuses.map((next) => (
                  <button
                    key={next}
                    disabled={busyFor === selected.id}
                    onClick={() => updateStatus(selected.id, next)}
                    className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${
                      next === "cancelled"
                        ? "bg-[#E8542A]/20 text-[#E8542A] hover:bg-[#E8542A]/40"
                        : "bg-[#E8542A] text-[#F5EFE4] hover:bg-[#FF6A3D]"
                    } disabled:opacity-50`}
                  >
                    → {STATUS_LABELS[next].label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 text-center">
        <Link href="/admin" className="text-sm text-[#F2B33D] hover:text-[#FFC93C]">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
