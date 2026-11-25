'use client';

import { copy, countText } from '@/lib/copy';
import {useSWRConfig} from 'swr';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, getCommunityUrl } from '@/lib/utils';
import { useSubscriptionStore, useAuth } from '@/hooks';
import { Card, Avatar, AvatarImage, AvatarFallback, Button, Skeleton, Badge } from '@/components/ui';
import { Hash, Users, Plus, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { Community } from '@/types';
import { navigateWithTechnologyTransition, TECHNOLOGY_COMMUNITY } from './technology-transition';

interface CommunityCardProps {
  community: Community;
  variant?: 'default' | 'compact';
  technologyTransition?: boolean;
}

export function CommunityCard({ community, variant = 'default', technologyTransition }: CommunityCardProps) {
  const router = useRouter();
  const {mutate}=useSWRConfig();
  const { isAuthenticated } = useAuth();
  const { isSubscribed, addSubscription, removeSubscription } = useSubscriptionStore();
  const [subscribing, setSubscribing] = React.useState(false);

  const subscribed = community.isSubscribed ?? isSubscribed(community.name);
  const href = getCommunityUrl(community.name);
  const title = community.displayName || community.name;
  const transitionTitle = technologyTransition && community.name === TECHNOLOGY_COMMUNITY;

  const handleSubscribe = async () => {
    if (!isAuthenticated || subscribing) return;

    setSubscribing(true);
    try {
      if (subscribed) {
        await api.unsubscribeCommunity(community.name);
        removeSubscription(community.name);
      } else {
        await api.subscribeCommunity(community.name);
        addSubscription(community.name);
      }
      await mutate(key=>Array.isArray(key)&&key[0]==='communities');
      await mutate(key=>Array.isArray(key)&&key[0]==='community'&&key[1]===community.name);
    } catch (err) {
      console.error('Subscribe failed:', err);
    } finally {
      setSubscribing(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={community.iconUrl} />
            <AvatarFallback><Hash className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{countText(community.subscriberCount, 'suscripción', 'suscripciones')}</p>
          </div>
        </Link>
        {isAuthenticated && (
          <Button type="button" size="sm" variant={subscribed ? 'secondary' : 'default'} onClick={handleSubscribe}
            aria-label={subscribed ? `Cancelar suscripción a ${title}` : `Suscribirse a ${title}`}
            disabled={subscribing} className="h-7 px-2">
            {subscribed ? <Check aria-hidden="true" className="h-3 w-3" /> : <Plus aria-hidden="true" className="h-3 w-3" />}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="flex flex-wrap items-start gap-3 p-4 transition-colors hover:border-muted-foreground/20 sm:flex-nowrap">
      <Link
        href={href}
        className="flex min-w-0 basis-full items-start gap-4 rounded sm:flex-1"
        onClick={transitionTitle ? event => navigateWithTechnologyTransition(event, title, () => router.push(href)) : undefined}
      >
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={community.iconUrl} />
          <AvatarFallback><Hash className="h-6 w-6" /></AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate" data-technology-transition-title={transitionTitle || undefined}>{title}</h3>
            {community.isNsfw && <Badge variant="destructive" className="text-xs">{copy.nSFW}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">/{community.name}</p>
          {community.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{community.description}</p>
          )}
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {countText(community.subscriberCount, 'suscripción', 'suscripciones')}
          </div>
        </div>
      </Link>
      {isAuthenticated && (
        <Button type="button" size="sm" variant={subscribed ? 'secondary' : 'default'} onClick={handleSubscribe} disabled={subscribing}>
          {subscribed ? copy.joined : copy.join}
        </Button>
      )}
    </Card>
  );
}

// Community List
interface CommunityListProps {
  communities: Community[];
  isLoading?: boolean;
  variant?: 'default' | 'compact';
  technologyTransition?: boolean;
}

export function CommunityList({ communities, isLoading, variant = 'default', technologyTransition }: CommunityListProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-4', variant === 'compact' && 'space-y-1')}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CommunityCardSkeleton key={i} variant={variant} />
        ))}
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div className="text-center py-8">
        <Hash className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">{copy.noCommunitiesFound}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', variant === 'compact' && 'space-y-1')}>
      {communities.map(community => (
        <CommunityCard key={community.id} community={community} variant={variant} technologyTransition={technologyTransition} />
      ))}
    </div>
  );
}

// Community Card Skeleton
export function CommunityCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-7 w-14" />
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-9 w-16" />
      </div>
    </Card>
  );
}

// Sidebar Community Widget
export function SidebarCommunities({ communities, title = copy.communities }: { communities: Community[]; title?: string }) {
  return (
    <Card>
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="p-2">
        <CommunityList communities={communities} variant="compact" />
      </div>
      <div className="p-2 border-t">
        <Link href="/comunidades">
          <Button variant="ghost" className="w-full text-sm">{copy.viewAllCommunities}</Button>
        </Link>
      </div>
    </Card>
  );
}

// Create Community Button
export function CreateCommunityButton() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <Link href="/comunidades/crear">
      <Button className="w-full gap-2">
        <Plus className="h-4 w-4" />
        {copy.createCommunity}
      </Button>
    </Link>
  );
}
