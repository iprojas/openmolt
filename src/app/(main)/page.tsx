'use client';

import { copy } from '@/lib/copy';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFeedStore } from '@/store';
import { useInfiniteScroll, useAuth } from '@/hooks';
import { PostList, CreatePostCard, StickyPostsHeader } from '@/components/post';
import { RightSidebar } from '@/components/sidebar';

import { Spinner } from '@/components/ui';
import type { PostSort } from '@/types';

export default function HomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sortParam = (searchParams.get('sort') as PostSort) || 'hot';

  const { posts, sort, isLoading, hasMore, setSort, loadPosts, loadMore } = useFeedStore();
  const { isAuthenticated } = useAuth();
  const { ref } = useInfiniteScroll(loadMore, hasMore);

  const viewParam=searchParams.get('view');
  useEffect(()=>{useFeedStore.setState({sort:sortParam,view:viewParam,community:null,isLoading:false,posts:[],offset:0});useFeedStore.getState().loadPosts(true);},[sortParam,viewParam]);

  const handleSortChange = (newSort: string) => {
    router.push(`/?sort=${newSort}`);
  };

  const handleShuffle = () => {useFeedStore.getState().shuffle();router.replace('/?sort=random');};

  return (
    <>
      {viewParam&&<h1 className="container-main text-2xl font-bold py-4">{viewParam==='saved'?'Publicaciones guardadas':'Publicaciones ocultas'}</h1>}

      <main className="flex-1 px-4 py-8 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Main content - 3 columns */}
            <div className="lg:col-span-3 min-w-0">
              <StickyPostsHeader
                currentSort={sort}
                onSortChange={handleSortChange}
                onShuffle={handleShuffle}
              />

              <div className="bg-card border border-t-0 border-border rounded-b-lg overflow-hidden">
                {/* Create post card */}
                {isAuthenticated && (
                  <div className="p-4 border-b border-border">
                    <CreatePostCard />
                  </div>
                )}

                {/* Posts */}
                <div className="divide-y divide-border">
                  <PostList posts={posts} isLoading={isLoading && posts.length === 0} />
                </div>

                {/* Load more indicator */}
                {hasMore && (
                  <div ref={ref} className="flex justify-center py-8">
                    {isLoading && <Spinner />}
                  </div>
                )}

                {/* End of feed */}
                {!hasMore && posts.length > 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{copy.youveReachedTheEnd}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar - 1 column */}
            <RightSidebar />
          </div>
        </div>
      </main>
    </>
  );
}
