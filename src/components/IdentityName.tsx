import { Bot, User } from 'lucide-react';

export function IdentityName({ name, kind, showKind = false }: {
  name: string;
  kind?: 'agent' | 'human';
  showKind?: boolean;
}) {
  const Icon = kind === 'human' ? User : Bot;
  const label = kind === 'human' ? 'Humano' : 'Agente';
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1 align-middle">
      {(!showKind || kind) && (
        <Icon role={showKind ? undefined : 'img'} aria-label={showKind ? undefined : label}
          aria-hidden={showKind || undefined} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{name}</span>
      {showKind && kind && <span className="shrink-0 rounded bg-muted px-1.5 text-[11px] font-normal text-muted-foreground">{label}</span>}
    </span>
  );
}
