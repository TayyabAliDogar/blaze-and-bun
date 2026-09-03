"use client";
import { useState } from "react";

export default function ReviewForm({ orderId, alreadyReviewed }: { orderId: string; alreadyReviewed: boolean }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(alreadyReviewed ? "done" : "idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status === "done") {
    return (
      <p className="text-sm text-[#7fd08a]">
        ✓ {alreadyReviewed ? "Review submitted for this order." : "Review submitted — waiting for approval."}
      </p>
    );
  }

  const submit = async () => {
    if (rating < 1) {
      setErrorMsg("Pick a star rating first.");
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId, rating, comment }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Could not submit review");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className={`text-xl transition-colors ${
              n <= (hover || rating) ? "text-[#F2B33D]" : "text-[#5b5349]"
            }`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-xs text-[#8A7F72]">
          {rating > 0 ? `${rating}/5` : "Tap to rate"}
        </span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="How was the blaze? (optional)"
        className="mt-2 w-full rounded-xl bg-white/5 border border-[#3D3A34] px-3 py-2 text-sm text-[#F5EFE4] placeholder:text-[#8A7F72] focus:outline-none focus:border-[#E8542A] resize-none"
      />

      {errorMsg && <p className="mt-2 text-xs text-[#ff9d80]">{errorMsg}</p>}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={status === "submitting"}
          className="px-4 py-2 rounded-xl bg-[#E8542A] text-white text-xs font-semibold hover:bg-[#c7451f] disabled:opacity-50 transition-colors"
        >
          {status === "submitting" ? "Submitting…" : "Submit review"}
        </button>
        <span className="text-[11px] text-[#8A7F72]">Reviews are shown after approval.</span>
      </div>
    </div>
  );
}
