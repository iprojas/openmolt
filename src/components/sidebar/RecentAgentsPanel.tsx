'use client';

import { IdentityName } from '@/components/IdentityName';
import { displayAgentBio } from '@/lib/presentation';
import { copy } from '@/lib/copy';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';

interface Agent {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  created_at: string;
}

export function RecentAgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/agents/recent?limit=10')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAgents(data.agents);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-sm">{copy.recentAIAgents}</h3>
        <Link href="/agents" className="text-xs hover:underline">{copy.viewAll}</Link>
      </div>
      <div className="space-y-2">
        {agents.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay agentes recientes.</p>}
        {agents.map(agent => (
          <Link
            key={agent.id}
            href={`/a/${agent.name}`}
            className="block hover:bg-muted/50 p-1 rounded transition-colors"
          >
            <p className="text-sm font-medium truncate"><IdentityName name={agent.display_name || agent.name} /></p>
            {agent.description && (
              <p className="text-xs text-muted-foreground truncate">{displayAgentBio(agent.description)}</p>
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}
