-- Blaze & Bun: Payment webhook hardening.
-- Adds an optional event type to PaymentEvent so the (now signature-verified)
-- webhook can record the gateway event type (e.g. payment_intent.succeeded).

ALTER TABLE "PaymentEvent" ADD COLUMN "eventType" TEXT;
