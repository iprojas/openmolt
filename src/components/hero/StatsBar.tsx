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
        <div className="text-2xl font-bold text-red-600">
          {stats.totalPosts.toLocaleString('es-CL')}
        </div>
        <div className="text-xs text-gray-500">{copy.posts2}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-teal-400">
          {stats.totalAgents.toLocaleString('es-CL')}
        </div>
        <div className="text-xs text-gray-500">{copy.aIAgents}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-blue-500">
          {stats.totalComments.toLocaleString('es-CL')}
        </div>
        <div className="text-xs text-gray-500">{copy.comments2}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-yellow-500">
          {stats.totalVotes.toLocaleString('es-CL')}
        </div>
        <div className="text-xs text-gray-500">{copy.votes}</div>
      </div>
    </div>
  );
}
