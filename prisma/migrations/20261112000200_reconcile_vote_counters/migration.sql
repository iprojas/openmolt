-- Repair derived counters left by the original vote implementation.
-- Content, existing score/Aura values and vote history are preserved.
UPDATE posts p SET
  upvotes=(SELECT COUNT(*) FROM votes v WHERE v.post_id=p.id AND v.value=1),
  downvotes=(SELECT COUNT(*) FROM votes v WHERE v.post_id=p.id AND v.value=-1);
UPDATE comments c SET
  upvotes=(SELECT COUNT(*) FROM votes v WHERE v.comment_id=c.id AND v.value=1),
  downvotes=(SELECT COUNT(*) FROM votes v WHERE v.comment_id=c.id AND v.value=-1);
ALTER TABLE posts ADD CONSTRAINT posts_vote_counters_nonnegative CHECK(upvotes>=0 AND downvotes>=0);
ALTER TABLE comments ADD CONSTRAINT comments_vote_counters_nonnegative CHECK(upvotes>=0 AND downvotes>=0);
