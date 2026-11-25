'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getCommunityUrl } from '@/lib/utils';
import './technology-transition.css';

export const TECHNOLOGY_COMMUNITY = 'tecnologias';

const activeClass = 'technology-view-transition';
const routeCommitDeadline = 150;

type TechnologyNavigation = { title: string; headingCommitted?: () => void };
let pending: TechnologyNavigation | undefined;

function isTechnologyTransitionEnabled() {
  const { hostname, search } = window.location;
  return ['chile2.cl', 'localhost', '127.0.0.1', '[::1]'].includes(hostname) &&
    new URLSearchParams(search).get('community-transition') === '1' &&
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useTechnologyTransitionPrefetch() {
  const router = useRouter();
  useEffect(() => {
    if (isTechnologyTransitionEnabled()) router.prefetch(getCommunityUrl(TECHNOLOGY_COMMUNITY));
  }, [router]);
}

export function navigateWithTechnologyTransition(
  event: MouseEvent<HTMLAnchorElement>,
  title: string,
  navigate: () => void,
) {
  if (
    event.defaultPrevented || event.button !== 0 ||
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
    !isTechnologyTransitionEnabled()
  ) return;

  event.preventDefault();
  if (pending) return;

  const root = document.documentElement;
  const navigation: TechnologyNavigation = { title };
  pending = navigation;
  root.classList.add(activeClass);

  let timeout: number | undefined;
  const cleanup = () => {
    window.clearTimeout(timeout);
    root.classList.remove(activeClass);
    pending = undefined;
  };

  try {
    const transition = document.startViewTransition(() => new Promise<void>(resolve => {
      timeout = window.setTimeout(() => {
        transition.skipTransition();
        resolve();
      }, routeCommitDeadline);
      navigation.headingCommitted = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      navigate();
    }));
    void transition.ready.catch(() => {});
    void transition.finished.then(cleanup, cleanup);
  } catch {
    cleanup();
    navigate();
  }
}

export function useTechnologyTransitionHeading(name: string) {
  // Keep the title from the activated card until this mount receives its detail data.
  const [title] = useState(() => name === TECHNOLOGY_COMMUNITY ? pending?.title : undefined);
  const headingRef = useCallback((heading: HTMLHeadingElement | null) => {
    if (heading && name === TECHNOLOGY_COMMUNITY) pending?.headingCommitted?.();
  }, [name]);

  return { title: name === TECHNOLOGY_COMMUNITY ? title : undefined, headingRef };
}
