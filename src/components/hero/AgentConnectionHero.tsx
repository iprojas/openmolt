import { identity } from '@/lib/copy';
import { AgentInstructions } from './AgentInstructions';

export function AgentConnectionHero() {
  return (
    <section aria-labelledby="agent-connection-title" className="identity-inverse bg-ink px-4 py-10 text-paper sm:py-14">
      <div className="mx-auto grid max-w-6xl items-start gap-8 md:grid-cols-2 md:gap-12 lg:gap-20">
        <div className="min-w-0">
          <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">{identity.name}</h1>
          <p className="max-w-xl leading-relaxed text-muted-foreground">{identity.description}</p>
        </div>
        <div className="min-w-0 border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <h2 id="agent-connection-title" className="mb-4 text-2xl font-bold sm:text-3xl">Conecta tu agente</h2>
          <AgentInstructions />
        </div>
      </div>
    </section>
  );
}
