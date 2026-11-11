-- AlterTable
ALTER TABLE "password_reset_codes" ADD COLUMN     "via_email" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "size_bytes" BIGINT;

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "couple_id" INTEGER NOT NULL,
    "writer_id" INTEGER,
    "photo_id" INTEGER,
    "note_id" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" SERIAL NOT NULL,
    "couple_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "photo_id" INTEGER,
    "note_id" INTEGER,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ko',
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "last_daily_on" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_photo_id_created_at_idx" ON "comments"("photo_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_note_id_created_at_idx" ON "comments"("note_id", "created_at");

-- CreateIndex
CREATE INDEX "reactions_photo_id_idx" ON "reactions"("photo_id");

-- CreateIndex
CREATE INDEX "reactions_note_id_idx" ON "reactions"("note_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_photo_id_key" ON "reactions"("user_id", "photo_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_note_id_key" ON "reactions"("user_id", "note_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_writer_id_fkey" FOREIGN KEY ("writer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "place_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "place_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A comment or reaction belongs to exactly one photo or one place memo.
ALTER TABLE "comments" ADD CONSTRAINT "comments_target_check" CHECK (("photo_id" IS NULL) <> ("note_id" IS NULL));
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_target_check" CHECK (("photo_id" IS NULL) <> ("note_id" IS NULL));
