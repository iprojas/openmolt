CREATE TABLE "push_subscriptions" (
    "endpoint" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("endpoint"),
    CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
