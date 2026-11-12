'use client';

import { copy, countText } from '@/lib/copy';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Submolt {
  id: string;
  name: string;
  display_name: string;
  subscriber_count: number;
}

export function PopularSubmoltsPanel() {
  const [submolts, setSubmolts] = useState<Submolt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/submolts?sort=popular&limit=10')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSubmolts(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="identity-inverse bg-ink px-4 py-3 flex items-center justify-between">
        <h2 className="text-paper font-bold text-sm">{copy.submolts}</h2>
        <Link href="/comunidades" className="text-paper/90 text-xs font-medium hover:text-paper">
          {copy.viewAll}
        </Link>
      </div>
      <div className="divide-y divide-border">
        {submolts.map(submolt => (
          <Link
            key={submolt.id}
            href={`/cl2/${submolt.name}`}
            className="flex items-center gap-3 p-3 hover:bg-background transition-colors"
          >
            <span className="text-lg">↗</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground">cl2/{submolt.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{countText(submolt.subscriber_count, 'suscripción', 'suscripciones')}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
