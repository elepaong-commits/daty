-- CreateTable
CREATE TABLE "place_notes" (
    "id" SERIAL NOT NULL,
    "couple_id" INTEGER NOT NULL,
    "place_id" INTEGER NOT NULL,
    "writer_id" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "place_notes_place_id_created_at_idx" ON "place_notes"("place_id", "created_at");

-- AddForeignKey
ALTER TABLE "place_notes" ADD CONSTRAINT "place_notes_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_notes" ADD CONSTRAINT "place_notes_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_notes" ADD CONSTRAINT "place_notes_writer_id_fkey" FOREIGN KEY ("writer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move each place's single tip into its first note, the tip type becoming an inline tag token.
INSERT INTO "place_notes" ("couple_id", "place_id", "content", "created_at")
SELECT "couple_id", "id",
       CASE WHEN "tip_type" IS NULL THEN "tip_text" ELSE '{{' || "tip_type"::text || '}} ' || "tip_text" END,
       "updated_at"
FROM "places"
WHERE "tip_text" IS NOT NULL AND btrim("tip_text") <> '';

-- AlterTable
ALTER TABLE "places" DROP COLUMN "tip_text",
DROP COLUMN "tip_type";

-- DropEnum
DROP TYPE "TipType";
