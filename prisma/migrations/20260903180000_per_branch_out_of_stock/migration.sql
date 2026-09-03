-- Per-branch out-of-stock tracking on the MenuItemPrice table.
ALTER TABLE "MenuItemPrice" ADD COLUMN IF NOT EXISTS "isOutOfStock" BOOLEAN NOT NULL DEFAULT false;
