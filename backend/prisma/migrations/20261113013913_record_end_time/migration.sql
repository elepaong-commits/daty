-- AlterTable
ALTER TABLE "date_records" ADD COLUMN     "ends_at" TIMESTAMPTZ(3);

-- A stop ends after it starts.
ALTER TABLE "date_records" ADD CONSTRAINT "date_records_ends_after_start" CHECK ("ends_at" IS NULL OR "ends_at" > "scheduled_at");
