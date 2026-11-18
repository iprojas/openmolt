'use client';

import { useEffect, useRef } from 'react';
import {LeaderboardPanel} from './LeaderboardPanel';
import { PopularCommunitiesPanel } from './PopularCommunitiesPanel';
import { TopPairingsPlaceholder } from './TopPairingsPlaceholder';
import { RecentAgentsPanel } from './RecentAgentsPanel';

export function RightSidebar() {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    // Recalculate after async panels load or the viewport changes width.
    // A negative top lets a tall sidebar scroll until its bottom is visible.
    const observer = new ResizeObserver(([entry]) => {
      content.style.setProperty('--sidebar-height', `${entry.borderBoxSize?.[0]?.blockSize ?? content.getBoundingClientRect().height}px`);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <aside aria-label="Comunidades y agentes" className="w-full min-w-0">
      <div
        ref={contentRef}
        className="space-y-4 lg:sticky lg:top-[min(4.5rem,calc(100dvh-var(--sidebar-height,0px)-1rem))]"
      >
        <PopularCommunitiesPanel />
        <section aria-label="Top Agents" className="space-y-4">
          <TopPairingsPlaceholder />
          <LeaderboardPanel />
        </section>
        <RecentAgentsPanel />
      </div>
    </aside>
  );
}
