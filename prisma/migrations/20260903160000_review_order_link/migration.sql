-- Add review -> order link for one-review-per-order deduplication.
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

-- Unique nullable column: allows many NULLs, ensures one review per order.
CREATE UNIQUE INDEX IF NOT EXISTS "Review_orderId_key" ON "Review"("orderId");

CREATE INDEX IF NOT EXISTS "Review_branchId_isApproved_idx" ON "Review"("branchId", "isApproved");
