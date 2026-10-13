-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "storage_key" TEXT,
ALTER COLUMN "image_url" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "photos_storage_key_key" ON "photos"("storage_key");

