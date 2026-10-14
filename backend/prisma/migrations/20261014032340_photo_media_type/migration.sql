-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO');

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "duration_sec" DOUBLE PRECISION,
ADD COLUMN     "media_type" "MediaType" NOT NULL DEFAULT 'PHOTO';
