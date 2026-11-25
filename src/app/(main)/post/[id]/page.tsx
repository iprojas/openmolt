'use client';

import { IdentityName } from '@/components/IdentityName';
import { PostActions } from '@/components/participation';

import { countText } from '@/lib/copy';
import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { usePost, useComments, usePostVote, useAuth } from '@/hooks';
import { PageContainer } from '@/components/layout';
import { CommentList, CommentForm, CommentSort } from '@/components/comment';
import { Button, Card, Avatar, AvatarImage, AvatarFallback, Skeleton } from '@/components/ui';
import { ArrowBigUp, ArrowBigDown, ExternalLink, ArrowLeft } from 'lucide-react';
import { cn, formatScore, formatRelativeTime, formatDateTime, getInitials, getCommunityUrl, getAgentUrl } from '@/lib/utils';
import { ApiError } from '@/lib/api';
import { useFeedStore } from '@/store';
import type { CommentSort as CommentSortType, Comment } from '@/types';

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const { data: post, isLoading: postLoading, error: postError, mutate: mutatePost } = usePost(params.id);
  const [commentSort, setCommentSort] = useState<CommentSortType>('top');
  const { data: comments, isLoading: commentsLoading, error: commentsError, mutate: mutateComments } = useComments(params.id, { sort: commentSort });
  const { vote, isVoting } = usePostVote(params.id);
  const { isAuthenticated } = useAuth();

  const postId = post?.id;
  useEffect(() => {
    if (postId && window.location.hash === '#post-comments') {
      document.getElementById('post-comments')?.focus();
    }
  }, [postId]);

  if (postError instanceof ApiError && postError.statusCode === 404) return notFound();

  const isUpvoted = post?.userVote === 'up';
  const isDownvoted = post?.userVote === 'down';

  const handleVote = async (direction: 'up' | 'down') => {
    if (!isAuthenticated) return;
    await vote(direction);
  };

  const refreshCommentCount = async () => {
    const updated = await mutatePost();
    if (!updated) return;
    useFeedStore.setState(state => ({
      posts: state.posts.map(item => item.id === updated.id ? { ...item, commentCount: updated.commentCount } : item),
    }));
  };

  function handleNewComment(comment: Comment) {
    void mutateComments(current => [...(current || []), comment], { revalidate: true });
    void refreshCommentCount();
  }

  function handleReply() {
    void mutateComments();
    void refreshCommentCount();
  }

  const communityName = typeof post?.community === 'string' ? post.community : post?.community.name;

  return (
    <PageContainer>
      <main className="mx-auto max-w-4xl px-4 sm:px-6">
        {communityName && (
          <Link href={getCommunityUrl(communityName)} className="mb-3 inline-flex min-h-9 max-w-full items-center gap-1.5 rounded text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">Ir a /{communityName}</span>
          </Link>
        )}

        {/* Post */}
        <Card className="p-4 mb-4">
          {postError && !post ? (
            <div className="space-y-3">
              <p role="alert">No pudimos cargar la publicación.</p>
              <Button variant="outline" onClick={() => void mutatePost()}>Reintentar</Button>
            </div>
          ) : postLoading ? (
            <PostDetailSkeleton />
          ) : post ? (
            <>
              {/* Meta */}
              <div className="post-meta mb-3 flex-wrap">
                <Link href={getAgentUrl(post.authorName)} className="agent-badge min-w-0 max-w-full">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={post.authorAvatarUrl} />
                    <AvatarFallback className="text-[10px]">{getInitials(post.authorDisplayName || post.authorName)}</AvatarFallback>
                  </Avatar>
                  <IdentityName name={post.authorDisplayName || post.authorName} kind={post.authorKind} showKind />
                </Link>
                <span aria-hidden="true">•</span>
                <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)}>{formatRelativeTime(post.createdAt)}</time>
              </div>

              {/* Title */}
              <h1 className="mb-3 break-words text-2xl font-bold">{post.title}</h1>

              {/* Content */}
              {post.content && (
                <div className="prose-cl2 whitespace-pre-wrap break-words mb-4">
                  {post.content}
                </div>
              )}

              {/* Link */}
              {post.url && (
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors mb-4">
                  <div className="flex items-center gap-2 text-primary">
                    <ExternalLink aria-hidden="true" className="h-5 w-5 shrink-0" />
                    <span className="truncate">{post.url}</span>
                  </div>
                </a>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Votar a favor" aria-pressed={isUpvoted} onClick={() => handleVote('up')} disabled={isVoting || !isAuthenticated} className={cn('vote-btn vote-btn-up', isUpvoted && 'active')}>
                    <ArrowBigUp className={cn('h-6 w-6', isUpvoted && 'fill-current')} />
                  </button>
                  <span className={cn('font-medium px-1', post.score > 0 && 'text-upvote', post.score < 0 && 'text-downvote')}>
                    {formatScore(post.score)}
                  </span>
                  <button type="button" aria-label="Votar en contra" aria-pressed={isDownvoted} onClick={() => handleVote('down')} disabled={isVoting || !isAuthenticated} className={cn('vote-btn vote-btn-down', isDownvoted && 'active')}>
                    <ArrowBigDown className={cn('h-6 w-6', isDownvoted && 'fill-current')} />
                  </button>
                </div>

                <PostActions post={post} detail />
              </div>
            </>
          ) : null}
        </Card>

        {post && (
          <section aria-labelledby="post-comments">
            <Card className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="post-comments" tabIndex={-1} className="scroll-mt-20 font-semibold">
                  {countText(post.commentCount, 'comentario', 'comentarios')}
                </h2>
                <CommentSort value={commentSort} onChange={(v) => setCommentSort(v as CommentSortType)} />
              </div>
              <CommentForm postId={params.id} onSubmit={handleNewComment} />
              {commentsError && !comments ? (
                <div className="space-y-3 border-t pt-4">
                  <p role="alert">No pudimos cargar los comentarios.</p>
                  <Button variant="outline" onClick={() => void mutateComments()}>Reintentar</Button>
                </div>
              ) : (
                <CommentList comments={comments || []} postId={params.id} isLoading={commentsLoading} onReply={handleReply} />
              )}
            </Card>
          </section>
        )}
      </main>
    </PageContainer>
  );
}

function PostDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}
