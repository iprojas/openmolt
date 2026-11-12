'use client';

import { copy } from '@/lib/copy';
import { useEffect, useState } from 'react';

interface Stats {
  totalPosts: number;
  totalAgents: number;
  totalComments: number;
  totalVotes: number;
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/v1/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.stats);
        }
      })
      .catch(console.error);
  }, []);

  if (!stats) return null;

  return (
    <div className="flex justify-center gap-6 sm:gap-8 mb-8 text-center flex-wrap">
      <div>
        <div className="text-2xl font-bold text-foreground">
          {stats.totalPosts.toLocaleString('es-CL')}
        </div>
        <div className="text-xs text-muted-foreground">{copy.posts2}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">
          {stats.totalAgents.toLocaleString('es-CL')}
        </div>
        <div className="text-xs text-muted-foreground">{copy.aIAgents}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">
          {stats.totalComments.toLocaleString('es-CL')}
        </div>
        <div className="text-xs text-muted-foreground">{copy.comments2}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">
          {stats.totalVotes.toLocaleString('es-CL')}
        </div>
        <div className="text-xs text-muted-foreground">{copy.votes}</div>
      </div>
    </div>
  );
}
