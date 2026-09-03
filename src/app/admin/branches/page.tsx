"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson, type AdminBranchDetail, type AdminBranchListResponse } from "@/lib/admin/api";

type BranchRow = AdminBranchDetail & { currencySymbol: string };

const CURRENCIES = ["USD", "GBP", "EUR"];

const SAMPLE_SCHEDULE: Record<string, unknown> = {
  monday: { open: "10:30", close: "22:00" },
  tuesday: { open: "10:30", close: "22:00" },
  wednesday: { open: "10:30", close: "22:00" },
  thursday: { open: "10:30", close: "22:30" },
  friday: { open: "10:30", close: "23:00" },
  saturday: { open: "10:00", close: "23:00" },
  sunday: { open: "10:00", close: "21:00" },
};

const scheduleToForm: (s: unknown) => string = (s) => {
  if (!s || typeof s !== "object") return "";
  const rec = s as Record<string, unknown>;
  const lines: string[] = [];
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const day of order) {
    const v = rec[day] as { open?: string; close?: string } | undefined;
    if (v && v.open && v.close) lines.push(`${day}: ${v.open}-${v.close}`);
  }
  return lines.join("\n");
};

const formToSchedule: (text: string) => Record<string, { open: string; close: string }> = (text) => {
  const out: Record<string, { open: string; close: string }> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const day = trimmed.slice(0, idx).trim().toLowerCase();
    const range = trimmed.slice(idx + 1).trim();
    const dash = range.indexOf("-");
    if (dash === -1) continue;
    const open = range.slice(0, dash).trim();
    const close = range.slice(dash + 1).trim();
    if (open && close && /^monday|tuesday|wednesday|thursday|friday|saturday|sunday$/.test(day)) {
      out[day] = { open, close };
    }
  }
  return out;
};

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [toasting, setToasting] = useState<{ id: string; isActive: boolean } | null>(null);

  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    country: "",
    currencyCode: "USD",
    phone: "",
    timezone: "America/New_York",
    openingHours: "",
    scheduleText: "",
    deliveryRadiusKm: 8,
    isDefault: false,
    isFeatured: false,
    parking: "",
    lat: 0,
    lng: 0,
  });

  const load = useCallback(async () => {
    try {
      const d = await adminJson<AdminBranchListResponse>("/api/admin/branches");
      setBranches(d.branches as BranchRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 2500);
  };

  const toggle = async (branch: BranchRow) => {
    const next = !branch.isActive;
    setToasting({ id: branch.id, isActive: next });
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/branches/${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setBranches((bs) => bs.map((b) => (b.id === branch.id ? { ...b, isActive: next } : b)));
      setError(null);
      flash(next ? "Branch opened" : "Branch paused");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setToasting(null);
    }
  };

  const openEdit = (branch: BranchRow) => {
    setEditing(branch);
    setForm({
      name: branch.name,
      address: branch.address,
      city: branch.city,
      country: branch.country,
      currencyCode: branch.currencyCode,
      phone: branch.phone ?? "",
      timezone: branch.timezone,
      openingHours: branch.openingHours,
      scheduleText: scheduleToForm(branch.schedule),
      deliveryRadiusKm: branch.deliveryRadiusKm,
      isDefault: branch.isDefault,
      isFeatured: branch.isFeatured,
      parking: branch.parking ?? "",
      lat: branch.lat,
      lng: branch.lng,
    });
    setError(null);
  };

  const save = async () => {
    if (!editing) return;
    if (!form.name.trim() || !form.address.trim() || !form.city.trim() || !form.country.trim()) {
      setError("Name, address, city and country are required");
      return;
    }
    setSaving(true);
    try {
      const schedule = formToSchedule(form.scheduleText);
      await adminJson<{ ok: boolean }>(`/api/admin/branches/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          city: form.city,
          country: form.country,
          currencyCode: form.currencyCode,
          phone: form.phone || null,
          timezone: form.timezone,
          openingHours: form.openingHours,
          schedule,
          deliveryRadiusKm: Number(form.deliveryRadiusKm),
          isDefault: form.isDefault,
          isFeatured: form.isFeatured,
          parking: form.parking || null,
          lat: Number(form.lat),
          lng: Number(form.lng),
        }),
      });
      flash("Branch updated");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setFormField = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Branch Controls</h1>
          <p className="text-sm text-[#8A7F72] mt-1">
            Manage branch operations, addresses, schedules, and availability. All changes are audited.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl text-[#F2B33D]">{branches.filter((b) => b.isActive).length}/{branches.length}</p>
          <p className="text-[10px] font-mono uppercase text-[#8A7F72]">open</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-[#E8542A]/15 border border-[#E8542A]/40 text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 rounded-lg bg-[#3D8B40]/20 border border-[#5FB96A]/40 text-sm">{message}</div>}

      {loading ? (
        <div className="text-center py-24 text-[#8A7F72]">Loading branches…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {branches.map((b) => (
            <div key={b.id} className={`p-5 rounded-2xl bg-white/[0.04] border border-white/10 ${!b.isActive ? "opacity-80" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-lg">{b.name}</p>
                    {b.isDefault && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-[#F2B33D]/20 text-[#F2B33D]">
                        default
                      </span>
                    )}
                    {b.isFeatured && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-white/10 text-[#8A7F72]">
                        featured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8A7F72]">{b.city} · {b.country}</p>
                  <p className="text-xs text-[#8A7F72] mt-0.5">{b.address}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider ${
                    b.isActive ? "bg-[#3D8B40]/20 text-[#5FB96A]" : "bg-[#E8542A]/20 text-[#E8542A]"
                  }`}
                >
                  {b.isActive ? "Open" : "Paused"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-[10px] font-mono uppercase text-[#8A7F72]">Hours</p>
                  <p className="font-mono text-xs mt-1 text-[#F5EFE4]/90">{b.openingHours}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-[10px] font-mono uppercase text-[#8A7F72]">Delivery radius</p>
                  <p className="font-mono text-xs mt-1 text-[#F5EFE4]/90">{b.deliveryRadiusKm} km</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => openEdit(b)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 font-mono text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
                >
                  ✏ Edit details
                </button>
                <button
                  onClick={() => toggle(b)}
                  disabled={toasting?.id === b.id}
                  className={`flex-1 py-3 rounded-xl font-mono text-xs uppercase tracking-wider transition-colors ${
                    b.isActive
                      ? "bg-[#E8542A]/20 text-[#E8542A] hover:bg-[#E8542A]/35"
                      : "bg-[#3D8B40]/20 text-[#5FB96A] hover:bg-[#3D8B40]/35"
                  } disabled:opacity-50`}
                >
                  {toasting?.id === b.id
                    ? "Updating…"
                    : b.isActive
                      ? "⏸ Pause branch"
                      : "▶ Reopen branch"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-3xl bg-[#1C120C] border border-white/10 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl mb-1">Edit branch</h2>
            <p className="text-sm text-[#8A7F72] mb-5">{editing.name}</p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Name *</span>
                <input
                  value={form.name}
                  onChange={(e) => setFormField("name", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) => setFormField("phone", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="md:col-span-2 block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Address *</span>
                <input
                  value={form.address}
                  onChange={(e) => setFormField("address", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">City *</span>
                <input
                  value={form.city}
                  onChange={(e) => setFormField("city", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Country *</span>
                <input
                  value={form.country}
                  onChange={(e) => setFormField("country", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Currency</span>
                <select
                  value={form.currencyCode}
                  onChange={(e) => setFormField("currencyCode", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c} className="bg-[#1C120C]">{c}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Timezone</span>
                <input
                  value={form.timezone}
                  onChange={(e) => setFormField("timezone", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Opening hours (display)</span>
                <input
                  value={form.openingHours}
                  onChange={(e) => setFormField("openingHours", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  placeholder="Mon–Sun · 10:30–22:00"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Delivery radius (km)</span>
                <input
                  type="number"
                  min={1}
                  step="0.5"
                  value={form.deliveryRadiusKm}
                  onChange={(e) => setFormField("deliveryRadiusKm", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Parking</span>
                <input
                  value={form.parking}
                  onChange={(e) => setFormField("parking", e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  placeholder="Street parking, garage nearby"
                />
              </label>
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <label className="block">
                  <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Latitude</span>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => setFormField("lat", e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-mono uppercase text-[#8A7F72]">Longitude</span>
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) => setFormField("lng", e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-[#E8542A]"
                  />
                </label>
              </div>
              <label className="md:col-span-2 block">
                <span className="text-[10px] font-mono uppercase text-[#8A7F72]">
                  Weekly schedule (one per line: {"{day}: HH:MM-HH:MM"})
                </span>
                <textarea
                  value={form.scheduleText}
                  onChange={(e) => setFormField("scheduleText", e.target.value)}
                  rows={7}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#E8542A]"
                  placeholder={"monday: 10:30-22:00\nsaturday: 10:00-23:00"}
                />
                <button
                  type="button"
                  onClick={() => setFormField("scheduleText", scheduleToForm(SAMPLE_SCHEDULE))}
                  className="mt-1 text-xs font-mono uppercase tracking-wider text-[#F2B33D] hover:text-[#FFC93C]"
                >
                  Load sample schedule
                </button>
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setFormField("isFeatured", e.target.checked)}
                    className="accent-[#E8542A]"
                  />
                  Featured branch
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#E8542A] text-[#241B14] text-sm font-medium hover:bg-[#FF6A3D] disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/admin" className="text-sm text-[#F2B33D] hover:text-[#FFC93C]">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
