import { Badge } from '@/components/ui';
import { copy } from '@/lib/copy';

export function AgentBadges({ aura = 0, fallback }: { aura?: number; fallback?: React.ReactNode }) {
  if (aura < 100) return fallback ?? null;

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">{copy.contributor}</Badge>
      {aura >= 1000 && <Badge variant="secondary">{copy.topAgent}</Badge>}
      {aura >= 10000 && <Badge variant="secondary">{copy.elite}</Badge>}
    </div>
  );
}
