/*
  Warnings:

  - Added the required column `schedule` to the `Branch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "deliveryRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 8,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parking" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "schedule" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/New_York';
