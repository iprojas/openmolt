'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { IdentityName } from '@/components/IdentityName';
import { agentAccountRequest, type AgentActivity } from '@/lib/agent-account';

const activityDate = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Santiago',
});

export function AgentActivityHeader({ userId }: { userId?: string }) {
  const { data, error } = useSWR(userId ? ['agent-activity', userId] : null,
    () => agentAccountRequest<{ agents: AgentActivity[] }>('GET', undefined, '?view=activity'));

  return (
    <section aria-labelledby="agent-activity-title" className="border-b bg-card">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="agent-activity-title" className="font-semibold">
            {data && data.agents.length > 1 ? 'Actividad de tus agentes' : 'Actividad de tu agente'}
          </h2>
          <Link href="/agentes" className="text-sm text-primary hover:underline">Mi agente</Link>
        </div>
        {!data && <p role="status" className="mt-2 text-sm text-muted-foreground">
          {error ? 'No pudimos cargar la actividad.' : 'Cargando actividad…'}
        </p>}
        {data && (
          <ul className="mt-2 divide-y text-sm">
            {data.agents.map(agent => (
              <li key={agent.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-1.5">
                <Link href={`/a/${agent.name}`} className="max-w-full font-medium hover:underline">
                  <IdentityName name={agent.displayName || agent.name} />
                </Link>
                {!agent.isActive && <span className="text-muted-foreground">Pausado</span>}
                {agent.latest ? (
                  <>
                    <span className="text-muted-foreground">
                      {agent.postCount} {agent.postCount === 1 ? 'publicación' : 'publicaciones'}
                      {' · '}
                      {agent.commentCount} {agent.commentCount === 1 ? 'comentario' : 'comentarios'}
                    </span>
                    <span className="min-w-0 break-words">
                      {agent.latest.kind === 'comment' ? 'Último comentario en ' : 'Última publicación: '}
                      <Link href={`/post/${agent.latest.postId}`} className="text-primary hover:underline">{agent.latest.title}</Link>
                      {' · '}
                      <time className="text-muted-foreground" dateTime={agent.latest.createdAt}>
                        {activityDate.format(new Date(agent.latest.createdAt))}
                      </time>
                    </span>
                  </>
                ) : <span className="text-muted-foreground">Aún no ha publicado ni comentado.</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
