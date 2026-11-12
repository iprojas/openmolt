-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "google_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'moltbook',
    "agent_name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "display_name" TEXT,
    "verification_code" TEXT,
    "claim_url" TEXT,
    "is_claimed" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "display_name" VARCHAR(64),
    "description" TEXT,
    "avatar_url" TEXT,
    "api_key_hash" VARCHAR(64) NOT NULL,
    "claim_token" VARCHAR(80),
    "verification_code" VARCHAR(16),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending_claim',
    "is_claimed" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "karma" INTEGER NOT NULL DEFAULT 0,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "owner_twitter_id" VARCHAR(64),
    "owner_twitter_handle" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "last_active" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submolts" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "display_name" VARCHAR(64),
    "description" TEXT,
    "avatar_url" TEXT,
    "banner_url" TEXT,
    "banner_color" VARCHAR(7),
    "theme_color" VARCHAR(7),
    "subscriber_count" INTEGER NOT NULL DEFAULT 0,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "creator_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submolts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submolt_moderators" (
    "id" TEXT NOT NULL,
    "submolt_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'moderator',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submolt_moderators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "submolt_id" TEXT NOT NULL,
    "submolt" VARCHAR(24) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "content" TEXT,
    "url" TEXT,
    "post_type" VARCHAR(10) NOT NULL DEFAULT 'text',
    "score" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_type" VARCHAR(10) NOT NULL,
    "value" SMALLINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "post_id" TEXT,
    "comment_id" TEXT,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "submolt_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "followed_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "platform_accounts_user_id_idx" ON "platform_accounts"("user_id");

-- CreateIndex
CREATE INDEX "platform_accounts_platform_idx" ON "platform_accounts"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_user_id_platform_agent_name_key" ON "platform_accounts"("user_id", "platform", "agent_name");

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_key" ON "agents"("name");

-- CreateIndex
CREATE INDEX "agents_name_idx" ON "agents"("name");

-- CreateIndex
CREATE INDEX "idx_agents_api_key_hash" ON "agents"("api_key_hash");

-- CreateIndex
CREATE INDEX "idx_agents_claim_token" ON "agents"("claim_token");

-- CreateIndex
CREATE UNIQUE INDEX "submolts_name_key" ON "submolts"("name");

-- CreateIndex
CREATE INDEX "submolts_name_idx" ON "submolts"("name");

-- CreateIndex
CREATE INDEX "idx_submolts_subscriber_count" ON "submolts"("subscriber_count" DESC);

-- CreateIndex
CREATE INDEX "idx_submolt_moderators_submolt" ON "submolt_moderators"("submolt_id");

-- CreateIndex
CREATE UNIQUE INDEX "submolt_moderators_submolt_id_agent_id_key" ON "submolt_moderators"("submolt_id", "agent_id");

-- CreateIndex
CREATE INDEX "idx_posts_author" ON "posts"("author_id");

-- CreateIndex
CREATE INDEX "idx_posts_submolt" ON "posts"("submolt_id");

-- CreateIndex
CREATE INDEX "idx_posts_submolt_name" ON "posts"("submolt");

-- CreateIndex
CREATE INDEX "idx_posts_created" ON "posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_posts_score" ON "posts"("score" DESC);

-- CreateIndex
CREATE INDEX "idx_comments_post" ON "comments"("post_id");

-- CreateIndex
CREATE INDEX "idx_comments_author" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "idx_comments_parent" ON "comments"("parent_id");

-- CreateIndex
CREATE INDEX "idx_votes_agent" ON "votes"("agent_id");

-- CreateIndex
CREATE INDEX "idx_votes_target" ON "votes"("target_id", "target_type");

-- CreateIndex
CREATE UNIQUE INDEX "votes_agent_id_target_id_target_type_key" ON "votes"("agent_id", "target_id", "target_type");

-- CreateIndex
CREATE INDEX "idx_subscriptions_agent" ON "subscriptions"("agent_id");

-- CreateIndex
CREATE INDEX "idx_subscriptions_submolt" ON "subscriptions"("submolt_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_agent_id_submolt_id_key" ON "subscriptions"("agent_id", "submolt_id");

-- CreateIndex
CREATE INDEX "idx_follows_follower" ON "follows"("follower_id");

-- CreateIndex
CREATE INDEX "idx_follows_followed" ON "follows"("followed_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_followed_id_key" ON "follows"("follower_id", "followed_id");

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submolts" ADD CONSTRAINT "submolts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submolt_moderators" ADD CONSTRAINT "submolt_moderators_submolt_id_fkey" FOREIGN KEY ("submolt_id") REFERENCES "submolts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submolt_moderators" ADD CONSTRAINT "submolt_moderators_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_submolt_id_fkey" FOREIGN KEY ("submolt_id") REFERENCES "submolts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_post_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_comment_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_submolt_id_fkey" FOREIGN KEY ("submolt_id") REFERENCES "submolts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A vote references exactly one target and retains the API's target discriminator.
ALTER TABLE "votes" ADD CONSTRAINT "votes_target_check" CHECK (
  (target_type = 'post' AND post_id IS NOT NULL AND post_id = target_id AND comment_id IS NULL)
  OR (target_type = 'comment' AND comment_id IS NOT NULL AND comment_id = target_id AND post_id IS NULL)
);
ALTER TABLE "votes" ADD CONSTRAINT "votes_value_check" CHECK (value IN (-1, 1));
