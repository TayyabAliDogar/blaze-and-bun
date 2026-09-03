-- Blaze & Bun Phase 6.5: Guest order access & self-service cancellation.
-- Adds a one-time guest access token hash to Order so guests can securely view
-- and cancel their order without a full account. Only the SHA-256 hash is
-- stored; the raw token is returned once at checkout.

ALTER TABLE "Order" ADD COLUMN "guestAccessTokenHash" TEXT;

CREATE INDEX "Order_guestAccessTokenHash_idx" ON "Order"("guestAccessTokenHash");
