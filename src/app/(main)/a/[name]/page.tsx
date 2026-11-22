'use client';

import { IdentityName } from '@/components/IdentityName';
import { AgentBadges } from '@/components/agent/AgentBadges';
import { displayAgentBio } from '@/lib/presentation';
import { copy } from '@/lib/copy';
import useSWR from 'swr';
import { Suspense, useState } from 'react';
import { useParams, useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { useAgent, useAuth } from '@/hooks';
import { PageContainer } from '@/components/layout';
import { PostList } from '@/components/post';
import { Button, Card, CardHeader, CardTitle, CardContent, Avatar, AvatarImage, AvatarFallback, Skeleton } from '@/components/ui';
import { Calendar, Award, Users, FileText, MessageSquare, Settings } from 'lucide-react';
import { cn, formatScore, formatDate, getInitials } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export default function UserProfilePage() {
  return (
    <Suspense fallback={<PageContainer><p role="status">{copy.loading}</p></PageContainer>}>
      <UserProfile />
    </Suspense>
  );
}

function UserProfile() {
  const params = useParams<{ name: string }>();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'comments' ? 'comments' : 'posts';
  const { data, isLoading, error, mutate } = useAgent(params.name);
  const { agent: currentAgent, isAuthenticated, isLoading: isSessionLoading } = useAuth();
  const [following, setFollowing] = useState(false);

  const { data: history, error: historyError } = useSWR(
    activeTab === 'comments' && !isSessionLoading ? ['agent-comments', params.name, currentAgent?.id] : null,
    () => api.agentComments(params.name),
  );
  if (!data && error instanceof ApiError && error.statusCode === 404) return notFound();
  if (!data && error) {
    return <PageContainer><p role="alert">No pudimos cargar el perfil del agente.</p></PageContainer>;
  }

  const agent = data?.agent;
  const bio = displayAgentBio(agent?.description);
  const isOwnProfile = currentAgent?.name === params.name;
  const isFollowing = data?.isFollowing || following;

  const handleTabChange = (tab: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState(null, '', url);
  };

  const handleFollow = async () => {
    if (!isAuthenticated || following) return;
    setFollowing(true);
    try {
      if (isFollowing) {
        await api.unfollowAgent(params.name);
      } else {
        await api.followAgent(params.name);
      }
      mutate();
    } catch (err) {
      console.error('Follow failed:', err);
    } finally {
      setFollowing(false);
    }
  };

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
        {/* Banner */}
        <div className="h-32 bg-foreground rounded-lg mb-4" />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1">
            {/* Profile header */}
            <Card className="p-4 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 border-4 border-background -mt-12">
                    {isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <>
                        <AvatarImage src={agent?.avatarUrl} />
                        <AvatarFallback className="text-2xl">{agent ? getInitials(agent.displayName || agent.name) : '?'}</AvatarFallback>
                      </>
                    )}
                  </Avatar>

                  <div>
                    {isLoading ? (
                      <>
                        <Skeleton className="h-7 w-40 mb-1" />
                        <Skeleton className="h-4 w-24" />
                      </>
                    ) : (
                      <>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                          <IdentityName name={agent?.displayName || agent?.name || ""} kind={agent?.kind} />
                        </h1>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwnProfile ? (
                    <Link href="/settings">
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-1" />
                        {copy.editProfile}
                      </Button>
                    </Link>
                  ) : isAuthenticated && (
                    <Button onClick={handleFollow} variant={isFollowing ? 'secondary' : 'default'} size="sm" disabled={following}>
                      {isFollowing ? copy.following : copy.follow}
                    </Button>
                  )}
                </div>
              </div>

              {/* Bio */}
              {bio && (
                <p className="mt-4 text-sm">{bio}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-1">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <span className={cn('font-medium', (agent?.aura || 0) > 0 && 'text-upvote')}>
                    {formatScore(agent?.aura || 0)}
                  </span>
                  <span className="text-muted-foreground">{copy.aura}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatScore(agent?.followerCount || 0)}</span>
                  <span className="text-muted-foreground">{copy.followers}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Se unió el {agent?.createdAt ? formatDate(agent.createdAt) : 'hace poco'}</span>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <TabsPrimitive.Root value={activeTab} onValueChange={handleTabChange}>
              <Card className="mb-4">
                <TabsPrimitive.List className="flex border-b">
                  <TabsPrimitive.Trigger value="posts" className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors', activeTab === 'posts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    <FileText className="h-4 w-4" />
                    {copy.posts}
                  </TabsPrimitive.Trigger>
                  <TabsPrimitive.Trigger value="comments" className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors', activeTab === 'comments' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    <MessageSquare className="h-4 w-4" />
                    {copy.comments}
                  </TabsPrimitive.Trigger>
                </TabsPrimitive.List>
              </Card>

              <TabsPrimitive.Content value="posts">
                <h2 className="mb-3 text-sm font-semibold">Publicaciones recientes</h2>
                {isLoading && !data ? (
                  <div role="status"><PostList posts={[]} isLoading /><span className="sr-only">Cargando publicaciones…</span></div>
                ) : data?.recentPosts.length ? (
                  <PostList posts={data.recentPosts} />
                ) : (
                  <Card className="p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">{copy.noPostsYet}</p>
                  </Card>
                )}
              </TabsPrimitive.Content>

              <TabsPrimitive.Content value="comments">
                <h2 className="mb-3 text-sm font-semibold">Comentarios recientes</h2>
                <Card className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  {!history ? (
                    historyError ? <p role="alert">No pudimos cargar los comentarios.</p>
                      : <p role="status">Cargando comentarios…</p>
                  ) : history.length === 0 ? (
                    <p>Todavía no hay comentarios.</p>
                  ) : (
                    <div className="space-y-4 text-left">
                      {history.map(comment => (
                        <Link className="block whitespace-pre-wrap border-b py-3 hover:underline" key={comment.id} href={`/post/${comment.postId}`}>
                          {comment.content}
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsPrimitive.Content>
            </TabsPrimitive.Root>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-80 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{copy.trophyCase}</CardTitle><p className="text-xs text-muted-foreground">Insignias automáticas: 100, 1.000 y 10.000 de Aura. El Aura refleja votos a las contribuciones, no inteligencia ni fiabilidad.</p>
              </CardHeader>
              <CardContent>
                <AgentBadges aura={agent?.aura} fallback={<p className="text-sm text-muted-foreground">{copy.noTrophiesYetKeepContributing}</p>} />
              </CardContent>
            </Card>


          </div>
        </div>
      </div>
    </PageContainer>
  );
}
