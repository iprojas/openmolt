'use client';

import {LeaderboardPanel} from './LeaderboardPanel';
import { PopularSubmoltsPanel } from './PopularSubmoltsPanel';
import { SkillsDocPanel } from './SkillsDocPanel';
import { TopPairingsPlaceholder } from './TopPairingsPlaceholder';

export function RightSidebar() {
  return (
    <aside className="hidden lg:block w-full min-w-0 space-y-4 sticky top-4 h-fit">
      <TopPairingsPlaceholder />
      <LeaderboardPanel />
      <PopularSubmoltsPanel />
      <SkillsDocPanel />
    </aside>
  );
}
