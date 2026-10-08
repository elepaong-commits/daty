/*
  Warnings:

  - You are about to drop the column `address` on the `date_records` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `date_records` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `date_records` table. All the data in the column will be lost.
  - You are about to drop the column `location_name` on the `date_records` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `date_records` table. All the data in the column will be lost.
  - You are about to drop the column `visited_at` on the `date_records` table. All the data in the column will be lost.
  - You are about to alter the column `rating` on the `date_records` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - You are about to drop the `record_images` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `scheduled_at` to the `date_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `date_records` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `category` on the `date_records` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PlaceCategory" AS ENUM ('FOOD', 'CAFE', 'EXHIBIT', 'TOUR', 'BAR', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "PlaceStatus" AS ENUM ('WISH', 'VISITED');

-- CreateEnum
CREATE TYPE "RecordType" AS ENUM ('PLAN', 'RECORD');

-- CreateEnum
CREATE TYPE "TipType" AS ENUM ('EAT', 'SEE', 'DO');

-- DropForeignKey
ALTER TABLE "date_records" DROP CONSTRAINT "date_records_writer_id_fkey";

-- DropForeignKey
ALTER TABLE "record_images" DROP CONSTRAINT "record_images_record_id_fkey";

-- AlterTable
ALTER TABLE "date_records" DROP COLUMN "address",
DROP COLUMN "content",
DROP COLUMN "latitude",
DROP COLUMN "location_name",
DROP COLUMN "longitude",
DROP COLUMN "visited_at",
ADD COLUMN     "album_id" INTEGER,
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "place_id" INTEGER,
ADD COLUMN     "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "type" "RecordType" NOT NULL DEFAULT 'PLAN',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "writer_id" DROP NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" "PlaceCategory" NOT NULL,
ALTER COLUMN "rating" SET DATA TYPE SMALLINT;

-- DropTable
DROP TABLE "record_images";

-- CreateTable
CREATE TABLE "places" (
    "id" SERIAL NOT NULL,
    "couple_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PlaceCategory" NOT NULL,
    "status" "PlaceStatus" NOT NULL DEFAULT 'WISH',
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "google_maps_url" TEXT,
    "google_place_id" TEXT,
    "tip_type" "TipType",
    "tip_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" SERIAL NOT NULL,
    "couple_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "album_date" DATE NOT NULL,
    "highlight_note" TEXT,
    "cover_photo_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" SERIAL NOT NULL,
    "album_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 1,
    "taken_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "places_couple_id_status_category_idx" ON "places"("couple_id", "status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "places_couple_id_google_place_id_key" ON "places"("couple_id", "google_place_id");

-- CreateIndex
CREATE INDEX "albums_couple_id_album_date_idx" ON "albums"("couple_id", "album_date");

-- CreateIndex
CREATE INDEX "photos_album_id_display_order_idx" ON "photos"("album_id", "display_order");

-- CreateIndex
CREATE INDEX "date_records_couple_id_scheduled_at_idx" ON "date_records"("couple_id", "scheduled_at");

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_records" ADD CONSTRAINT "date_records_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_records" ADD CONSTRAINT "date_records_writer_id_fkey" FOREIGN KEY ("writer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_records" ADD CONSTRAINT "date_records_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
