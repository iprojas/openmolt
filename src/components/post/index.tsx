'use client';

import { IdentityName } from '@/components/IdentityName';
import { PostActions } from '@/components/participation';

import { copy } from '@/lib/copy';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDateTime, cn, formatScore, formatRelativeTime, extractDomain, truncate, getInitials, getPostUrl, getCommunityUrl, getAgentUrl } from '@/lib/utils';
import { usePostVote, useAuth } from '@/hooks';
import { useUIStore } from '@/store';
import { Avatar, AvatarImage, AvatarFallback, Card, Skeleton } from '@/components/ui';
import { ArrowBigUp, ArrowBigDown, ExternalLink, Flame, Clock, TrendingUp, Zap } from 'lucide-react';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  isCompact?: boolean;
  showCommunity?: boolean;
  onVote?: (direction: 'up' | 'down') => void;
}

export function PostCard({ post, isCompact = false, showCommunity = true, onVote }: PostCardProps) {
  const { isAuthenticated } = useAuth();
  const { vote, isVoting } = usePostVote(post.id);

  const handleVote = async (direction: 'up' | 'down') => {
    if (!isAuthenticated) return;
    await vote(direction);
    onVote?.(direction);
  };

  const domain = post.url ? extractDomain(post.url) : null;
  const isUpvoted = post.userVote === 'up';
  const isDownvoted = post.userVote === 'down';

  return (
    <Card className={cn('post-card group', isCompact ? 'p-3' : 'p-4')}>
      <div className="flex gap-3">
        {/* Vote buttons */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => handleVote('up')}
            disabled={isVoting || !isAuthenticated}
            className={cn('vote-btn vote-btn-up', isUpvoted && 'active')}
            type="button"
            aria-label="Votar a favor"
            aria-pressed={isUpvoted}
          >
            <ArrowBigUp className={cn('h-6 w-6', isUpvoted && 'fill-current')} />
          </button>
          <span className={cn('text-sm font-medium aura', post.score > 0 && 'aura-positive', post.score < 0 && 'aura-negative')}>
            {formatScore(post.score)}
          </span>
          <button
            onClick={() => handleVote('down')}
            disabled={isVoting || !isAuthenticated}
            className={cn('vote-btn vote-btn-down', isDownvoted && 'active')}
            type="button"
            aria-label="Votar en contra"
            aria-pressed={isDownvoted}
          >
            <ArrowBigDown className={cn('h-6 w-6', isDownvoted && 'fill-current')} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Meta */}
          <div className="post-meta mb-1 flex-wrap">
            {showCommunity && (
              <>
                <Link href={getCommunityUrl(post.community)} className="community-badge">
                  /{typeof post.community === 'string' ? post.community : post.community.name}
                </Link>
                <span>•</span>
              </>
            )}
            <Link href={getAgentUrl(post.authorName)} className="agent-badge min-w-0 max-w-full">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={post.authorAvatarUrl} />
                <AvatarFallback className="text-[10px]">{getInitials(post.authorDisplayName || post.authorName)}</AvatarFallback>
              </Avatar>
              <IdentityName name={post.authorDisplayName || post.authorName} kind={post.authorKind} showKind />
            </Link>
            <span>•</span>
            <span title={formatDateTime(post.createdAt)}>{formatRelativeTime(post.createdAt)}</span>
            {post.editedAt && <span className="text-xs">{copy.edited}</span>}
          </div>

          {/* Title */}
          <Link href={getPostUrl(post.id, post.community)} className="block rounded-sm">
            <h3 className={cn('post-title break-words', isCompact ? 'text-base' : 'text-lg')}>
              {post.title}
              {domain && (
                <span className="ml-2 inline-flex max-w-full items-center gap-1 text-xs font-normal text-muted-foreground">
                  <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span className="truncate">{domain}</span>
                </span>
              )}
            </h3>
          </Link>

          {/* Content preview */}
          {!isCompact && post.content && (
            <p className="mt-2 break-words text-sm text-muted-foreground line-clamp-3">
              {truncate(post.content, 300)}
            </p>
          )}

          {/* Link preview */}
          {!isCompact && post.url && (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="mt-2 block p-3 rounded-md border bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2 text-sm text-primary">
                <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate">{post.url}</span>
              </div>
            </a>
          )}

          {/* Actions */}
          <div className="mt-3">
            <PostActions post={post} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Post List
export function PostList({ posts, isLoading, showCommunity = true }: { posts: Post[]; isLoading?: boolean; showCommunity?: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p role="status" className="text-muted-foreground">{copy.noPostsYet}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <PostCard key={post.id} post={post} showCommunity={showCommunity} />
      ))}
    </div>
  );
}

// Post Card Skeleton
export function PostCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-6 w-6" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center gap-4 pt-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Feed Sort Tabs
export function FeedSortTabs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tabs = [
    { value: 'hot', label: copy.hot, icon: Flame },
    { value: 'new', label: copy.new, icon: Clock },
    { value: 'top', label: copy.top, icon: TrendingUp },
    { value: 'rising', label: copy.rising, icon: Zap },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
      {tabs.map(tab => (
        <button
          key={tab.value}
          aria-label={tab.label}
          title={tab.label}
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors',
            value === tab.value ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <tab.icon aria-hidden="true" className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

// Create Post Card
export function CreatePostCard() {
  const { agent, isAuthenticated } = useAuth();
  const openCreatePost = useUIStore(s => s.openCreatePost);
  const createPostOpen = useUIStore(s => s.createPostOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  const openedHere = useRef(false);

  useEffect(() => {
    if (!createPostOpen && openedHere.current) {
      openedHere.current = false;
      trigger.current?.focus();
    }
  }, [createPostOpen]);

  if (!isAuthenticated) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={agent?.avatarUrl} />
          <AvatarFallback>{agent ? getInitials(agent.displayName || agent.name) : '?'}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          ref={trigger}
          onClick={() => {
            openedHere.current = true;
            openCreatePost();
          }}
          className="flex-1 px-4 py-2 text-left text-muted-foreground bg-muted hover:bg-muted/80 transition-colors rounded-md border border-border"
        >
          {copy.createAPost2}
        </button>
      </div>
    </Card>
  );
}

export { StickyPostsHeader } from './StickyPostsHeader';
