-- Blaze & Bun: Corrective migration for drift between schema and migration history.
--
-- The live database (and the Prisma schema) had two changes applied manually that
-- were never captured in migration files:
--   1. Order.etaMinutes            -> nullable integer column
--   2. PaymentStatus 'refunded'    -> new enum variant
--
-- On a FRESH database (prisma migrate deploy) these were previously missing, which
-- broke order placement (checkout writes etaMinutes) and cancellation refunds
-- (cancel writes paymentStatus = 'refunded'). This migration restores parity.
--
-- It is written to be NON-DESTRUCTIVE and idempotent so it is also safe to re-run
-- against the already-patched live database.

-- 1. Order.etaMinutes (nullable integer). Guarded so re-runs are no-ops.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "etaMinutes" INTEGER;

-- 2. PaymentStatus enum variant 'refunded'.
-- The init migration creates this enum as ('unpaid','paid','failed'); we add
-- 'refunded' if and only if it isn't already present. pg_enum holds the enum
-- member at the end, which is fine for values we never rely on reordering.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentStatus'
      AND e.enumlabel = 'refunded'
  ) THEN
    ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'refunded';
  END IF;
END
$$;
