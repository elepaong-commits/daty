-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "fingerprint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "photos_album_id_fingerprint_key" ON "photos"("album_id", "fingerprint");

