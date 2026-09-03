"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson, type AdminPromo, type AdminPromoListResponse, type AdminBranchSummary } from "@/lib/admin/api";

interface PromoRow extends AdminPromo {
  discountLabel: string;
  scopeLabel: string;
  statusLabel: "active" | "expired" | "scheduled" | "disabled";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;
  if (Math.abs(diff) < 24 * 3600 * 1000) {
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toRow(p: AdminPromo): PromoRow {
  const discountLabel =
    p.discountType === "percent"
      ? `${p.discountValue}%${p.maxDiscount !== null ? ` (max ${p.maxDiscount.toFixed(2)})` : ""}`
      : `$${p.discountValue.toFixed(2)}`;
  const scopeLabel = p.branch ? p.branch.name : "All branches";
  let statusLabel: PromoRow["statusLabel"];
  if (!p.isActive) statusLabel = "disabled";
  else if (p.isExpired) statusLabel = "expired";
  else if (p.startsInFuture) statusLabel = "scheduled";
  else statusLabel = "active";
  return { ...p, discountLabel, scopeLabel, statusLabel };
}

const STATUS_COLORS: Record<PromoRow["statusLabel"], string> = {
  active: "bg-[#3D8B40]/20 text-[#5FB96A]",
  expired: "bg-[#E8542A]/20 text-[#E8542A]",
  scheduled: "bg-[#F2B33D]/20 text-[#F2B33D]",
  disabled: "bg-white/10 text-[#8A7F72]",
};

export default function AdminPromosPage() {
  const [branches, setBranches] = useState<AdminBranchSummary[]>([]);
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [scope, setScope] = useState<"active" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    maxDiscount: "",
    minOrderAmount: "0",
    usageLimit: "",
    branchId: "",
    startsAt: "",
    expiresAt: "",
  });

  const load = useCallback(async () => {
    try {
      const [menuResp, promosResp] = await Promise.all([
        adminJson<{ ok: boolean; branches: AdminBranchSummary[] }>("/api/admin/menu"),
        adminJson<AdminPromoListResponse>(`/api/admin/promos?scope=${scope}`),
      ]);
      setBranches(menuResp.branches);
      setPromos(promosResp.promos.map(toRow));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 2500);
  };

  const setField = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const openCreate = () => {
    setForm({
      code: "",
      description: "",
      discountType: "percent",
      discountValue: "",
      maxDiscount: "",
      minOrderAmount: "0",
      usageLimit: "",
      branchId: "",
      startsAt: "",
      expiresAt: "",
    });
    setError(null);
    setShowCreate(true);
  };

  const createPromo = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      setError("Code and description are required");
      return;
    }
    setSaving(true);
    try {
      await adminJson<{ ok: boolean }>("/api/admin/promos", {
        method: "POST",
        body: JSON.stringify({
          code: form.code,
          description: form.description,
          discountType: form.discountType,
          discountValue: form.discountValue === "" ? undefined : Number(form.discountValue),
          maxDiscount: form.maxDiscount === "" ? null : Number(form.maxDiscount),
          minOrderAmount: Number(form.minOrderAmount || 0),
          usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
          branchId: form.branchId || null,
          startsAt: form.startsAt || null,
          expiresAt: form.expiresAt || null,
        }),
      });
      flash("Promo code created");
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: PromoRow) => {
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/promos/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      flash(p.isActive ? "Promo disabled" : "Promo enabled");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  const deactivate = async (p: PromoRow) => {
    if (!window.confirm(`Deactivate "${p.code}"? It will stop being accepted at checkout.`)) return;
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/promos/${p.id}`, { method: "DELETE" });
      flash(`"${p.code}" deactivated`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deactivate failed");
    }
  };

  const counts = {
    active: promos.filter((p) => p.statusLabel === "active").length,
    expired: promos.filter((p) => p.statusLabel === "expired" || p.statusLabel === "scheduled").length,
    disabled: promos.filter((p) => p.statusLabel === "disabled").length,
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Promo Codes</h1>
          <p className="text-sm text-[#8A7F72] mt-1">
            Create discount codes, track usage, and manage availability.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] font-mono text-xs uppercase tracking-wider hover:bg-[#FF6A3D] transition-colors"
        >
          + New promo
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-[#E8542A]/15 border border-[#E8542A]/40 text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 rounded-lg bg-[#3D8B40]/20 border border-[#5FB96A]/40 text-sm">{message}</div>}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setScope("active")}
          className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${
            scope === "active" ? "bg-[#E8542A] text-[#241B14]" : "bg-white/5 text-[#8A7F72] hover:bg-white/10"
          }`}
        >
          Active ({counts.active})
        </button>
        <button
          onClick={() => setScope("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${
            scope === "all" ? "bg-[#E8542A] text-[#241B14]" : "bg-white/5 text-[#8A7F72] hover:bg-white/10"
          }`}
        >
          All ({counts.active + counts.expired + counts.disabled})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-24 text-[#8A7F72]">Loading promos…</div>
      ) : promos.length === 0 ? (
        <div className="text-center py-24 text-[#8A7F72]">
          No promo codes found. Create one to start driving orders.
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.2fr_2fr_1fr_1fr_1.2fr_auto] gap-4 px-5 py-3 border-b border-white/10 text-[10px] font-mono uppercase text-[#8A7F72]">
            <div>Code</div>
            <div>Description</div>
            <div>Discount</div>
            <div>Usage</div>
            <div>Expiry</div>
            <div className="text-right">Actions</div>
          </div>
          <ul className="divide-y divide-white/5">
            {promos.map((p) => (
              <li key={p.id} className="px-5 py-4 md:grid md:grid-cols-[1.2fr_2fr_1fr_1fr_1.2fr_auto] md:gap-4 md:items-center">
                <div>
                  <p className="font-mono text-[#F2B33D]">{p.code}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${STATUS_COLORS[p.statusLabel]}`}>
                    {p.statusLabel}
                  </span>
                </div>
                <div className="mt-2 md:mt-0">
                  <p className="text-sm">{p.description}</p>
                  <p className="text-[11px] text-[#8A7F72]">{p.scopeLabel} · min order {p.minOrderAmount.toFixed(2)}</p>
                </div>
                <div className="mt-2 md:mt-0 font-mono text-sm">{p.discountLabel}</div>
                <div className="mt-2 md:mt-0">
                  <div className="flex items-center justify-between text-[11px] text-[#8A7F72]">
                    <span>{p.usedCount}{p.usageLimit !== null ? `/${p.usageLimit}` : ""} used</span>
                    {p.usagePercent !== null && <span>{p.usagePercent}%</span>}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#F2B33D]"
                      style={{ width: `${p.usagePercent ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="mt-2 md:mt-0">
                  <p className="text-sm">{formatDate(p.expiresAt)}</p>
                  {p.startsAt && <p className="text-[11px] text-[#8A7F72]">from {formatDate(p.startsAt)}</p>}
                </div>
                <div className="mt-3 md:mt-0 flex items-center gap-2 md:justify-end">
                  <button
                    onClick={() => toggleActive(p)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    {p.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => deactivate(p)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider text-[#E8542A]/70 hover:text-[#E8542A] hover:bg-[#E8542A]/10 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-xl bg-[#1C120C] border border-white/10 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl mb-1">New promo code</h2>
            <p className="text-sm text-[#8A7F72] mb-5">Set the discount, scope, and validity window.</p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Code *</span>
                <input
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[#E8542A]"
                  placeholder="FIRESALE20"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Type</span>
                <select
                  value={form.discountType}
                  onChange={(e) => setField("discountType", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                >
                  <option value="percent" className="bg-[#1C120C]">Percent (%)</option>
                  <option value="fixed" className="bg-[#1C120C]">Fixed ($)</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">
                  {form.discountType === "percent" ? "Percent off *" : "Amount off *"}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discountValue}
                  onChange={(e) => setField("discountValue", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">
                  {form.discountType === "percent" ? "Max discount ($)" : "—"}
                </span>
                {form.discountType === "percent" ? (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.maxDiscount}
                    onChange={(e) => setField("maxDiscount", e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                    placeholder="Optional"
                  />
                ) : (
                  <div className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#8A7F72]">Unused for fixed</div>
                )}
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Min order ($)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.minOrderAmount}
                  onChange={(e) => setField("minOrderAmount", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Usage limit</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.usageLimit}
                  onChange={(e) => setField("usageLimit", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  placeholder="Unlimited"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Scope (branch)</span>
                <select
                  value={form.branchId}
                  onChange={(e) => setField("branchId", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                >
                  <option value="" className="bg-[#1C120C]">All branches</option>
                  {branches.map((br) => (
                    <option key={br.id} value={br.id} className="bg-[#1C120C]">
                      {br.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Starts</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setField("startsAt", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A] [color-scheme:dark]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Expires</span>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setField("expiresAt", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A] [color-scheme:dark]"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Description *</span>
                <input
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  placeholder="20% off your first blaze (min $20)"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button
                onClick={createPromo}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] text-sm font-medium hover:bg-[#FF6A3D] disabled:opacity-50 transition-colors"
              >
                {saving ? "Creating…" : "Create promo"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/admin" className="text-sm text-[#F2B33D] hover:text-[#FFC93C]">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
