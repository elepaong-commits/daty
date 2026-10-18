-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlaceCategory" ADD VALUE 'DESSERT';
ALTER TYPE "PlaceCategory" ADD VALUE 'HOTEL';

-- AlterTable
ALTER TABLE "albums" ADD COLUMN     "monthly" BOOLEAN NOT NULL DEFAULT false;
