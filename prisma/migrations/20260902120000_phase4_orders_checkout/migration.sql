-- Blaze & Bun Phase 4: Cart, Order Customization Snapshot & Checkout Engine.
-- Adds promo codes, promo redemptions, order status logs and the payment
-- event idempotency ledger, plus guest/delivery/payment fields on Order.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DeliveryType" AS ENUM ('pickup', 'delivery');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('card', 'googlepay', 'applepay', 'cod');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusChangeSource" AS ENUM ('system', 'customer', 'staff', 'admin', 'payment');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable (extend existing orders)
ALTER TABLE "Order" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryType" "DeliveryType" NOT NULL DEFAULT 'delivery';
ALTER TABLE "Order" ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "paymentMethod" "PaymentMethod";
ALTER TABLE "Order" ADD COLUMN "promoCodeId" TEXT;

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "maxDiscount" DECIMAL(10,2),
    "minOrderAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "branchId" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "source" "StatusChangeSource" NOT NULL DEFAULT 'system',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "orderId" TEXT,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_branchId_idx" ON "PromoCode"("branchId");
CREATE INDEX "PromoCode_isActive_expiresAt_idx" ON "PromoCode"("isActive", "expiresAt");
CREATE INDEX "PromoRedemption_promoCodeId_email_idx" ON "PromoRedemption"("promoCodeId", "email");
CREATE INDEX "PromoRedemption_email_idx" ON "PromoRedemption"("email");
CREATE UNIQUE INDEX "PromoRedemption_orderId_key" ON "PromoRedemption"("orderId");
CREATE INDEX "OrderStatusLog_orderId_createdAt_idx" ON "OrderStatusLog"("orderId", "createdAt");
CREATE INDEX "PaymentEvent_orderId_idx" ON "PaymentEvent"("orderId");
CREATE INDEX "Order_guestEmail_idx" ON "Order"("guestEmail");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderStatusLog" ADD CONSTRAINT "OrderStatusLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;