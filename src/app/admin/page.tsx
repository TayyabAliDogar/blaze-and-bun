"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson, type AnalyticsResponse } from "@/lib/admin/api";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await adminJson<AnalyticsResponse>("/api/admin/analytics");
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const fmt = (n: number) => formatter.format(n);

  if (loading) {
    return <div className="text-center py-24 text-[#8A7F72]">Loading dashboard…</div>;
  }
  if (error || !data) {
    return (
      <div className="text-center py-24">
        <p className="text-[#E8542A] mb-4">{error ?? "Could not load analytics."}</p>
        <button onClick={load} className="text-[#F2B33D] hover:text-[#FFC93C] text-sm">
          Retry
        </button>
      </div>
    );
  }

  const stats = [
    { label: "Total Revenue", value: fmt(data.totals.revenue), accent: "text-[#F2B33D]" },
    { label: "Total Orders", value: String(data.totals.orders), accent: "text-[#F5EFE4]" },
    { label: "Avg Order Value", value: fmt(data.totals.avgOrderValue), accent: "text-[#5FB96A]" },
    { label: "Today's Orders", value: String(data.today.orders), accent: "text-[#F5EFE4]" },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl md:text-4xl mb-6">Analytics Overview</h1>
      <p className="text-sm text-[#8A7F72] mb-8">Live store-wide metrics · {new Date(data.generatedAt).toLocaleString()}</p>

      {/* KPI cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
            <p className="text-[11px] font-mono uppercase tracking-widest text-[#8A7F72] mb-2">{s.label}</p>
            <p className={`text-2xl font-mono ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Status breakdown */}
        <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#8A7F72] mb-4">Orders by status</h2>
          <div className="space-y-3">
            {Object.entries(data.statusBreakdown)
              .map(([status, count]) => ({ status, count }))
              .sort((a, b) => b.count - a.count)
              .map(({ status, count }) => {
                const pct =
                  data.totals.orders > 0 ? Math.round((count / data.totals.orders) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-white/70">{status}</span>
                      <span className="text-[#8A7F72]">{count}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#E8542A] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top selling per branch */}
        <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#8A7F72] mb-4">Top sellers &amp; branch revenue</h2>
          <div className="space-y-4">
            {data.branches.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-white/90">{b.name}</p>
                  <p className="text-xs text-[#8A7F72]">{b.orders} orders</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[#F2B33D]">{fmt(b.revenue)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#8A7F72]">
                    {b.isActive ? "Open" : "Paused"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top items table */}
      <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#8A7F72] mb-4">Top selling items by branch</h2>
        <div className="space-y-6">
          {Object.entries(data.topByBranch).map(([branchId, items]) => (
            <div key={branchId}>
              <p className="text-sm text-white/90 mb-2">{items[0]?.branchName ?? branchId}</p>
              <table className="w-full text-sm">
                <tbody>
                  {items.slice(0, 5).map((it) => (
                    <tr key={it.menuItemId} className="border-t border-white/5">
                      <td className="py-2 capitalize text-white/80">{it.name}</td>
                      <td className="py-2 text-[#8A7F72] text-xs">×{it.quantity}</td>
                      <td className="py-2 text-right font-mono text-[#F2B33D]">{fmt(it.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {Object.keys(data.topByBranch).length === 0 && (
            <p className="text-sm text-[#8A7F72]">No sales yet.</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-3 justify-center">
        <Link href="/admin/orders" className="inline-block px-6 py-3 rounded-full bg-[#E8542A] text-[#F5EFE4] text-sm font-mono uppercase tracking-wider hover:bg-[#FF6A3D]">
          Open Orders →
        </Link>
        <Link href="/admin/branches" className="inline-block px-6 py-3 rounded-full border border-white/20 text-sm text-[#F5EFE4] hover:bg-white/5">
          Branch Controls
        </Link>
      </div>
    </div>
  );
}
