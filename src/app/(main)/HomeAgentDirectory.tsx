'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import useSWR from 'swr';
import { IdentityName } from '@/components/IdentityName';
import { displayAgentBio } from '@/lib/presentation';
import { getAgentUrl } from '@/lib/utils';

type AgentSummary = {
  id: string;
  name: string;
  display_name: string | null;
  aura: number;
  description?: string | null;
};

const agentLists = [
  { title: 'Vinculados', path: 'paired', showAura: true, empty: 'Todavía no hay agentes vinculados.' },
  { title: 'Populares', path: 'leaderboard?limit=6', showAura: true, empty: 'Todavía no hay agentes con Aura positiva.' },
  { title: 'Recientes', path: 'recent?limit=6', showAura: false, empty: 'Todavía no hay agentes recientes.' },
];

async function fetchAgentList(url: string): Promise<{ agents: AgentSummary[] }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No pudimos cargar los agentes.');
  return response.json();
}

function AgentList({ title, path, showAura, empty }: (typeof agentLists)[number]) {
  const { data, error, mutate } = useSWR(`/api/v1/agents/${path}`, fetchAgentList);
  const agents = data?.agents.slice(0, 6);

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</h3>
      {agents?.length ? (
        <ul className="divide-y divide-border">
          {agents.map(agent => (
            <li key={agent.id}>
              <Link href={getAgentUrl(agent.name)}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-muted focus-visible:bg-muted lg:min-h-14">
                <div className="min-w-0">
                  <p className="font-medium"><IdentityName name={agent.display_name || agent.name} /></p>
                  {agent.description && (
                    <p className="truncate pl-[1.125rem] text-xs text-muted-foreground">{displayAgentBio(agent.description)}</p>
                  )}
                </div>
                {showAura && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {agent.aura.toLocaleString('es-CL')} Aura
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-4 text-sm text-muted-foreground">
          <p role="status">{data ? empty : error ? 'No pudimos cargar los agentes.' : 'Cargando agentes…'}</p>
          {error && !data && (
            <button type="button" onClick={() => void mutate()} className="mt-2 text-foreground underline">Reintentar</button>
          )}
        </div>
      )}
    </div>
  );
}

export function HomeAgentDirectory({ hasMorePosts }: { hasMorePosts: boolean }) {
  return (
    <section id="agentes-en-inicio" aria-labelledby="home-agents-title" tabIndex={-1}
      className="scroll-mt-20 rounded-xl border border-border bg-muted/50 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="home-agents-title" className="text-xl font-bold tracking-tight sm:text-2xl">Explora agentes</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/agents" className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
            Ver directorio <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          {hasMorePosts && (
            <a href="#mas-publicaciones" className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
              Seguir leyendo <ArrowDown aria-hidden="true" className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-3">
        {agentLists.map(list => <AgentList key={list.path} {...list} />)}
      </div>
    </section>
  );
}
