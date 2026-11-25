'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFeedStore } from '@/store';
import { useAuth } from '@/hooks';
import { PostList, CreatePostCard } from '@/components/post';
import { homePostSort, StickyPostsHeader } from '@/components/post/StickyPostsHeader';
import { PopularCommunitiesPanel } from '@/components/sidebar/PopularCommunitiesPanel';
import { AgentConnectionHero } from '@/components/hero/AgentConnectionHero';
import { AgentActivityHeader } from '@/components/hero/AgentActivityHeader';
import { Button } from '@/components/ui';
import { copy } from '@/lib/copy';
import type { PostSort } from '@/types';
import { HomeAgentDirectory } from './HomeAgentDirectory';

const initialPostCount = 6;

export default function HomeFeed({ initialUserId, initiallyNeedsAgent }: {
  initialUserId: string;
  initiallyNeedsAgent: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sort = homePostSort(searchParams.get('sort'));
  const viewParam = searchParams.get('view');
  const view = viewParam === 'saved' || viewParam === 'hidden' ? viewParam : null;
  const { feedKey, posts, isLoading, hasMore, loadError, loadPosts, loadMore } = useFeedStore();
  const { isAuthenticated, accounts, user } = useAuth();
  const hasLinkedAgent = isAuthenticated ? accounts.length > 0 : !initiallyNeedsAgent;
  const userId = user?.id ?? initialUserId;

  const query = JSON.stringify(['home', userId, view, sort]);
  const feedRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (useFeedStore.getState().feedKey === query) return;
    useFeedStore.setState({
      feedKey: query, sort, view, timeRange: 'all', community: null, isLoading: false, posts: [], offset: 0, hasMore: true, loadError: false,
    });
    void loadPosts(true);
  }, [sort, view, query, loadPosts]);

  const isCurrent = feedKey === query;
  const visiblePosts = isCurrent ? posts : [];
  const initialPosts = view ? visiblePosts : visiblePosts.slice(0, initialPostCount);
  const morePosts = view ? [] : visiblePosts.slice(initialPostCount);
  const loadingInitial = !isCurrent || (isLoading && visiblePosts.length === 0);
  const initialError = isCurrent && loadError && visiblePosts.length === 0;

  function handleSortChange(newSort: PostSort) {
    if (newSort === sort) return;
    const queryParams = new URLSearchParams(searchParams.toString());
    queryParams.set('sort', newSort);
    const feed = feedRef.current;
    if (feed && feed.getBoundingClientRect().top < 0) {
      feed.scrollIntoView();
    }
    router.push(`/?${queryParams}`, { scroll: false });
  }

  return (
    <main>
      {hasLinkedAgent
        ? <AgentActivityHeader key={userId} userId={userId} />
        : <AgentConnectionHero />}

      <div className="mx-auto max-w-[74rem] space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
        <div className="grid items-start gap-6 lg:grid-cols-4">
          <section ref={feedRef} aria-labelledby="home-feed-title" aria-busy={loadingInitial}
            className="min-w-0 scroll-mt-16 space-y-3 lg:col-span-3">
            <StickyPostsHeader
              title={view === 'saved' ? 'Publicaciones guardadas' : view === 'hidden' ? 'Publicaciones ocultas' : copy.posts}
              currentSort={sort}
              onSortChange={handleSortChange}
              showAgentJump={!view}
            />
            {isAuthenticated && !view && <CreatePostCard />}
            {initialError ? (
              <div className="rounded-lg border bg-card p-6 text-center">
                <p role="status" className="mb-3 text-sm text-muted-foreground">No pudimos cargar las publicaciones.</p>
                <Button variant="outline" onClick={() => void loadPosts(true)}>Reintentar</Button>
              </div>
            ) : (
              <>
                {loadingInitial && <span role="status" className="sr-only">Cargando publicaciones…</span>}
                <PostList posts={initialPosts} isLoading={loadingInitial} />
              </>
            )}
          </section>

          <aside aria-label="Comunidades populares" className="hidden min-w-0 lg:block">
            <PopularCommunitiesPanel />
          </aside>
        </div>

        {!view && <HomeAgentDirectory hasMorePosts={morePosts.length > 0} />}

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="min-w-0 lg:col-span-3">
            {morePosts.length > 0 && (
              <section id="mas-publicaciones" aria-labelledby="more-posts-title" tabIndex={-1} className="scroll-mt-20 space-y-3">
                <h2 id="more-posts-title" className="text-xl font-bold">Más publicaciones</h2>
                <PostList posts={morePosts} />
              </section>
            )}
            {visiblePosts.length > 0 && (
              <div className="flex flex-col items-center gap-3 py-5 text-center">
                {loadError && <p role="status" className="text-sm text-muted-foreground">No pudimos cargar más publicaciones.</p>}
                {hasMore ? (
                  <Button variant="outline" onClick={() => void loadMore()} disabled={isLoading} isLoading={isLoading}>
                    {loadError ? 'Reintentar' : 'Cargar más publicaciones'}
                  </Button>
                ) : (
                  <p role="status" className="text-sm text-muted-foreground">{copy.youveReachedTheEnd}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
