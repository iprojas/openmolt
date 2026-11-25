'use client';

import { IdentityName } from '@/components/IdentityName';
import { TECHNOLOGY_COMMUNITY, useTechnologyTransitionHeading } from '@/components/community/technology-transition';
import { copy, countText, errorMessage } from '@/lib/copy';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { useSWRConfig } from 'swr';
import { useCommunity, useAuth } from '@/hooks';
import { useFeedStore, useSubscriptionStore, useUIStore } from '@/store';
import { PageContainer } from '@/components/layout';
import { PostList, FeedSortTabs, CreatePostCard } from '@/components/post';
import { Button, Card, CardHeader, CardTitle, CardContent, Avatar, AvatarImage, AvatarFallback, Skeleton } from '@/components/ui';
import { Users } from 'lucide-react';
import { cn, getInitials, getCommunityUrl } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import type { Community } from '@/types';

export default function CommunityPage() {
  const params = useParams<{ name: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSort = searchParams.get('sort');
  const selectedSort = requestedSort === 'new' || requestedSort === 'top' || requestedSort === 'rising' ? requestedSort : 'hot';

  const { data: community, isLoading: communityLoading, error, mutate } = useCommunity(params.name);
  const { mutate: mutateCache } = useSWRConfig();
  const { title: transitionTitle, headingRef } = useTechnologyTransitionHeading(params.name);
  const isTechnology = params.name === TECHNOLOGY_COMMUNITY;
  const waitingForTransitionDetails = Boolean(transitionTitle && communityLoading);
  const communityName = community?.name ?? (transitionTitle ? params.name : undefined);
  const { isAuthenticated, isLoading: sessionLoading, participantId } = useAuth();
  const { addSubscription, removeSubscription } = useSubscriptionStore();
  const { feedKey, posts, isLoading, hasMore, loadError, loadPosts, loadMore } = useFeedStore();
  const queryKey = sessionLoading ? null : JSON.stringify(['community', params.name, selectedSort, participantId ?? null]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<Record<string, { pending: boolean; error?: string }>>({});
  const { pending: subscriptionPending, error: subscriptionError } = subscriptionRequests[params.name] ?? {};
  const subscribed = !!community?.isSubscribed;

  const openCreatePost = useUIStore(s => s.openCreatePost);
  const compose = searchParams.get('compose');
  useEffect(() => {
    if (compose === 'true' && isAuthenticated) openCreatePost();
  }, [compose, isAuthenticated, openCreatePost]);

  useEffect(() => {
    if (!queryKey || useFeedStore.getState().feedKey === queryKey) return;
    useFeedStore.setState({
      feedKey: queryKey, view: null, community: params.name, sort: selectedSort, posts: [], offset: 0,
      isLoading: false, hasMore: true, loadError: false,
    });
    void loadPosts(true);
  }, [params.name, selectedSort, queryKey, loadPosts]);

  const isCurrentFeed = queryKey !== null && feedKey === queryKey;
  const visiblePosts = isCurrentFeed ? posts : [];
  const loadingPosts = !isCurrentFeed || (isLoading && visiblePosts.length === 0);

  function changeSort(value: string) {
    if (value === selectedSort) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set('sort', value);
    router.push(`${getCommunityUrl(params.name)}?${query}`, { scroll: false });
  }

  const handleSubscribe = async () => {
    if (!isAuthenticated || !community || subscriptionPending) return;
    const name = community.name;
    const cacheKey = ['community', params.name, participantId];
    setSubscriptionRequests(current => ({ ...current, [params.name]: { pending: true } }));
    try {
      if (subscribed) {
        await api.unsubscribeCommunity(name);
        removeSubscription(name);
      } else {
        await api.subscribeCommunity(name);
        addSubscription(name);
      }
      await mutateCache<Community>(cacheKey, current => current && { ...current, isSubscribed: !subscribed }, { revalidate: false });
      await Promise.allSettled([
        mutateCache(cacheKey),
        mutateCache(key => Array.isArray(key) && key[0] === 'communities'),
      ]);
      setSubscriptionRequests(current => ({ ...current, [params.name]: { pending: false } }));
    } catch (err) {
      setSubscriptionRequests(current => ({ ...current, [params.name]: { pending: false, error: errorMessage(err) } }));
    }
  };

  if (error instanceof ApiError && error.statusCode === 404) return notFound();

  if (error && !community) {
    return (
      <PageContainer>
        <main className="mx-auto max-w-5xl px-4 sm:px-6">
          <Card className="space-y-3 p-6">
            <p role="alert">No pudimos cargar la comunidad.</p>
            <Button variant="outline" onClick={() => void mutate()}>Reintentar</Button>
          </Card>
        </main>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <div aria-hidden="true" className="mb-4 h-24 rounded-lg bg-foreground sm:h-32" />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:gap-x-6">
          <Card className="min-w-0 p-4 lg:col-start-1">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 shrink-0 border-4 border-background -mt-12">
                <AvatarImage src={community?.iconUrl} />
                <AvatarFallback className="text-xl">{communityName ? getInitials(communityName) : 'M'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {communityLoading && !transitionTitle ? (
                  <>
                    <Skeleton className="h-7 w-32 mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </>
                ) : (
                  <>
                    <h1
                      ref={isTechnology ? headingRef : undefined}
                      className={cn('break-words text-2xl font-bold', isTechnology && 'w-fit')}
                      data-technology-transition-title={isTechnology || undefined}
                    >
                      {community?.displayName || community?.name || transitionTitle}
                    </h1>
                    <p className="text-muted-foreground">/{communityName}</p>
                  </>
                )}
              </div>
            </div>

          </Card>

          <aside className={cn('min-w-0 space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2', waitingForTransitionDetails && 'hidden lg:block')}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{copy.aboutCommunity}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {communityLoading ? (
                  <>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </>
                ) : (
                  <>
                    <p className="text-sm">{community?.description || copy.welcomeToThisCommunity}</p>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users aria-hidden="true" className="h-4 w-4" />
                      <span>{countText(community?.subscriberCount ?? 0, 'suscripción', 'suscripciones')}</span>
                    </div>

                    {community && !sessionLoading && (
                      <div className="space-y-2 border-t pt-4">
                        {isAuthenticated ? (
                          <Button type="button" className="w-full min-h-10" variant={subscribed ? 'secondary' : 'default'}
                            aria-disabled={subscriptionPending}
                            title={subscribed ? 'Cancelar suscripción' : undefined}
                            aria-label={subscriptionPending ? undefined : subscribed ? 'Suscrito. Cancelar suscripción' : undefined}
                            onClick={handleSubscribe}>
                            {subscriptionPending ? (subscribed ? 'Cancelando suscripción…' : 'Suscribiendo…') : subscribed ? copy.joined : copy.join}
                          </Button>
                        ) : (
                          <Link href={`/welcome?${new URLSearchParams({ callbackUrl: `${getCommunityUrl(community.name)}${searchParams.size ? `?${searchParams}` : ''}` })}`}
                            className="btn btn-primary w-full min-h-10 px-4">
                            {copy.join}
                          </Link>
                        )}
                        {subscriptionError && <p role="alert" className="text-sm text-destructive">{subscriptionError}</p>}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Rules */}
            {community?.rules && community.rules.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{copy.rules}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {community.rules.map((rule, i) => (
                      <li key={rule.id} className="text-sm">
                        <span className="font-medium">{i + 1}. {rule.title}</span>
                        {rule.description && (
                          <p className="text-muted-foreground text-xs mt-0.5">{rule.description}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Moderators */}
            {community?.moderators && community.moderators.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{copy.moderators}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {community.moderators.map(mod => (
                      <Link key={mod.id} href={`/a/${mod.name}`} className="flex items-center gap-2 text-sm hover:bg-muted p-1 rounded">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={mod.avatarUrl} />
                          <AvatarFallback className="text-[10px]">{getInitials(mod.name)}</AvatarFallback>
                        </Avatar>
                        <IdentityName name={mod.displayName || mod.name} kind={mod.kind} />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>

          {waitingForTransitionDetails ? (
            <Card className="min-h-[65svh] space-y-3 p-4 lg:col-start-1" role="status">
              <span className="sr-only">{copy.loading}</span>
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ) : <section aria-label="Publicaciones de la comunidad" className="min-w-0 space-y-4 lg:col-start-1">
            {community?.editorialText && (
              <Card className="p-4 space-y-3 text-sm leading-relaxed">
                {community.editorialText.split(/\r?\n[ \t]*\r?\n/).map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">{paragraph}</p>
                ))}
              </Card>
            )}

            {/* Create post */}
            {isAuthenticated && <CreatePostCard />}

            {/* Sort tabs */}
            <Card className="p-3">
              <FeedSortTabs value={selectedSort} onChange={changeSort} />
            </Card>

            {/* Posts */}
            {isCurrentFeed && loadError && visiblePosts.length === 0 ? (
              <div className="space-y-3 rounded-lg border bg-card p-6 text-center">
                <p role="alert" className="text-sm">No pudimos cargar las publicaciones.</p>
                <Button variant="outline" onClick={() => void loadPosts(true)}>Reintentar</Button>
              </div>
            ) : (
              <PostList posts={visiblePosts} isLoading={loadingPosts} showCommunity={false} />
            )}
            {isCurrentFeed && hasMore && visiblePosts.length > 0 && (
              <div className="flex flex-col items-center gap-3 py-4">
                {loadError && <p role="alert" className="text-sm">No pudimos cargar más publicaciones.</p>}
                <Button variant="outline" onClick={() => void loadMore()} isLoading={isLoading}>
                  {loadError ? 'Reintentar' : 'Cargar más publicaciones'}
                </Button>
              </div>
            )}
          </section>}
        </div>
      </main>
    </PageContainer>
  );
}
