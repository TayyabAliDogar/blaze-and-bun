"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson, type AdminReview, type AdminReviewListResponse } from "@/lib/admin/api";

type StatusFilter = "all" | "approved" | "pending";
type RatingFilter = "all" | "1" | "2" | "3" | "4" | "5";

const RATING_META: Record<number, { label: string; color: string }> = {
  5: { label: "Exceptional", color: "text-[#5FB96A]" },
  4: { label: "Great", color: "text-[#7fd08a]" },
  3: { label: "Okay", color: "text-[#F2B33D]" },
  2: { label: "Meh", color: "text-[#ffc55c]" },
  1: { label: "Poor", color: "text-[#E8542A]" },
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-xs tracking-wide text-[#F2B33D]">
      {"★".repeat(rating)}
      <span className="text-[#8A7F72]">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [counts, setCounts] = useState({ approved: 0, pending: 0, total: 0 });
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (rating !== "all") params.set("rating", rating);
      params.set("limit", "100");
      const d = await adminJson<AdminReviewListResponse>(`/api/admin/reviews?${params.toString()}`);
      setReviews(d.reviews);
      setCounts(d.counts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [status, rating]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 2500);
  };

  const setApproval = async (r: AdminReview, approved: boolean) => {
    setBusyId(r.id);
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/reviews/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isApproved: approved }),
      });
      flash(approved ? "Review approved" : "Review rejected (moved to pending)");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const deleteReview = async (r: AdminReview) => {
    if (!window.confirm("Permanently delete this review? This cannot be undone.")) return;
    setBusyId(r.id);
    try {
      await adminJson<{ ok: boolean }>(`/api/admin/reviews/${r.id}`, { method: "DELETE" });
      flash("Review deleted");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Review Moderation</h1>
          <p className="text-sm text-[#8A7F72] mt-1">
            Approve, reject, or remove customer ratings before they go live.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl text-[#F2B33D]">{counts.pending}</p>
          <p className="text-[10px] font-mono uppercase text-[#8A7F72]">awaiting review</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-[#E8542A]/15 border border-[#E8542A]/40 text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 rounded-lg bg-[#3D8B40]/20 border border-[#5FB96A]/40 text-sm">{message}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "all"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors capitalize ${
                status === s ? "bg-[#E8542A] text-[#241B14]" : "bg-white/5 text-[#8A7F72] hover:bg-white/10"
              }`}
            >
              {s === "all" ? `all (${counts.total})` : `${s} (${counts[s]})`}
            </button>
          ))}
        </div>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value as RatingFilter)}
          className="ml-auto rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[#8A7F72] focus:outline-none focus:border-[#E8542A]"
        >
          <option value="all" className="bg-[#1C120C]">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={String(r)} className="bg-[#1C120C]">{r}★</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-24 text-[#8A7F72]">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-24 text-[#8A7F72]">
          {status === "pending" ? "Nothing waiting for review. Nice." : "No reviews match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const meta = RATING_META[r.rating];
            return (
              <div key={r.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-display text-lg ${r.isApproved ? "text-[#F5EFE4]" : "text-[#8A7F72]"}`}>
                        {r.user?.name ?? "Guest"}
                      </span>
                      <span className="text-xs text-[#8A7F72]">{r.user?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Stars rating={r.rating} />
                      <span className={`text-[11px] font-mono uppercase ${meta.color}`}>{r.rating}/5 · {meta.label}</span>
                    </div>
                    <p className="text-xs text-[#8A7F72] mt-1">
                      {r.branch.name} · {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider ${
                      r.isApproved ? "bg-[#3D8B40]/20 text-[#5FB96A]" : "bg-[#F2B33D]/20 text-[#F2B33D]"
                    }`}
                  >
                    {r.isApproved ? "Approved" : "Pending"}
                  </span>
                </div>

                {r.comment && (
                  <p className="mt-3 text-sm text-[#F5EFE4]/85 leading-relaxed">“{r.comment}”</p>
                )}

                <div className="mt-4 flex items-center gap-2 pt-3 border-t border-white/5">
                  {!r.isApproved ? (
                    <button
                      onClick={() => setApproval(r, true)}
                      disabled={busyId === r.id}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider bg-[#3D8B40]/20 text-[#5FB96A] hover:bg-[#3D8B40]/35 disabled:opacity-50 transition-colors"
                    >
                      ✓ Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => setApproval(r, false)}
                      disabled={busyId === r.id}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider bg-[#F2B33D]/20 text-[#F2B33D] hover:bg-[#F2B33D]/35 disabled:opacity-50 transition-colors"
                    >
                      ↺ Reject
                    </button>
                  )}
                  <button
                    onClick={() => deleteReview(r)}
                    disabled={busyId === r.id}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider text-[#E8542A]/70 hover:text-[#E8542A] hover:bg-[#E8542A]/10 disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
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
