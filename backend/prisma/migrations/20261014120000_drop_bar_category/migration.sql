-- Bars are folded into restaurants.
UPDATE "places" SET "category" = 'FOOD' WHERE "category" = 'BAR';
UPDATE "date_records" SET "category" = 'FOOD' WHERE "category" = 'BAR';

-- AlterEnum
BEGIN;
CREATE TYPE "PlaceCategory_new" AS ENUM ('FOOD', 'CAFE', 'EXHIBIT', 'TOUR', 'ACTIVITY');
ALTER TABLE "places" ALTER COLUMN "category" TYPE "PlaceCategory_new" USING ("category"::text::"PlaceCategory_new");
ALTER TABLE "date_records" ALTER COLUMN "category" TYPE "PlaceCategory_new" USING ("category"::text::"PlaceCategory_new");
ALTER TYPE "PlaceCategory" RENAME TO "PlaceCategory_old";
ALTER TYPE "PlaceCategory_new" RENAME TO "PlaceCategory";
DROP TYPE "PlaceCategory_old";
COMMIT;
