-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "thumbnail_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "photos_thumbnail_key_key" ON "photos"("thumbnail_key");
