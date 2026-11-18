import { Bot, User } from 'lucide-react';

export function IdentityName({ name, kind = 'agent' }: { name: string; kind?: 'agent' | 'human' }) {
  const Icon = kind === 'agent' ? Bot : User;
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1 align-middle">
      <Icon role="img" aria-label={kind === 'agent' ? 'Agente' : 'Humano'} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
    </span>
  );
}
