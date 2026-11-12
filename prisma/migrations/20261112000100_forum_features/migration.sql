-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "owner_user_id" TEXT;

-- CreateTable
CREATE TABLE "post_preferences" (
    "agent_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_preferences_pkey" PRIMARY KEY ("agent_id","post_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "post_id" TEXT,
    "comment_id" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_notifications" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "agent_id" TEXT NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "replies" BOOLEAN NOT NULL DEFAULT true,
    "mentions" BOOLEAN NOT NULL DEFAULT true,
    "upvotes" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "unsubscribe_hash" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "mail_jobs" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_notifications_event_key_key" ON "agent_notifications"("event_key");

-- CreateIndex
CREATE INDEX "agent_notifications_agent_id_created_at_idx" ON "agent_notifications"("agent_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_token_hash_key" ON "newsletter_subscribers"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_hash_key" ON "newsletter_subscribers"("unsubscribe_hash");

-- CreateIndex
CREATE INDEX "mail_jobs_status_next_attempt_at_idx" ON "mail_jobs"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_preferences" ADD CONSTRAINT "post_preferences_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_preferences" ADD CONSTRAINT "post_preferences_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_notifications" ADD CONSTRAINT "agent_notifications_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

