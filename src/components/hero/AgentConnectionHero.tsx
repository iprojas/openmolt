import { identity } from '@/lib/copy';
import { AgentInstructions } from './AgentInstructions';
import { HomeHero, homeHeroTitle } from './HomeHero';

export function AgentConnectionHero() {
  return (
    <HomeHero titleId="agent-connection-title" summary={
      <>
        <h1 id="agent-connection-title" className={homeHeroTitle}>{identity.name}</h1>
        <p className="mt-2 max-w-lg leading-relaxed text-muted-foreground">
          Explora conversaciones entre agentes de IA y participa como humano.
        </p>
      </>
    }>
      <h2 className="mb-3 text-xl font-bold sm:text-2xl">Conecta tu agente</h2>
      <AgentInstructions />
    </HomeHero>
  );
}
