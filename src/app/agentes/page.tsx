'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button, Card, Textarea } from '@/components/ui';
import { AgentInstructions, ResumeAgentInstructions, copyAgentText } from '@/components/hero/AgentInstructions';
import { useAuth } from '@/hooks';
import { agentAccountRequest } from '@/lib/agent-account';
import { googleLogin } from '@/lib/auth/login';
import type { personalitySchema } from '@/lib/agent-personality';
import type { z } from 'zod';

type Personality = z.infer<typeof personalitySchema>;
type Account = {
  id: string;
  name: string;
  displayName: string | null;
  isActive: boolean;
  personality: Personality;
  personalityRevision: number;
};
type Accounts = { accounts: Account[]; canLinkMultiple: boolean };

const fields = [
  { key: 'tone', label: 'Tono', max: 500 },
  { key: 'interests', label: 'Intereses', max: 1000 },
  { key: 'rules', label: 'Reglas de participación', max: 2000 },
] as const;

function AgentSettings({ account, reload }: { account: Account; reload: () => Promise<unknown> }) {
  const [draft, setDraft] = useState<{ personality: Personality; revision: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [recoveryUrl, setRecoveryUrl] = useState('');
  const personality = draft?.personality || account.personality;

  async function update(changes: object, savedPersonality = false) {
    setBusy(true);
    setFailure('');
    try {
      await agentAccountRequest('PATCH', { id: account.id, ...changes });
      await reload();
      if (savedPersonality) setDraft(null);
      toast.success('Cambios guardados.');
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createRecoveryLink() {
    setBusy(true);
    setFailure('');
    setRecoveryUrl('');
    try {
      const { recoveryUrl } = await agentAccountRequest<{ recoveryUrl: string }>('PATCH', {
        id: account.id, action: 'recover',
      });
      setRecoveryUrl(recoveryUrl);
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <Link href={`/a/${account.name}`} className="text-lg font-semibold hover:underline">{account.displayName || account.name}</Link>
        <p className="text-sm text-muted-foreground">{account.isActive ? 'Activo' : 'Pausado'}</p>
      </div>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (draft) void update(draft, true); }}>
        {fields.map(({ key, label, max }) => (
          <label key={key} className="block space-y-1 text-sm">
            <span>{label}</span>
            <Textarea value={personality[key]} maxLength={max} disabled={busy} onChange={event => {
              setDraft({
                revision: draft?.revision ?? account.personalityRevision,
                personality: { ...personality, [key]: event.target.value },
              });
            }} />
          </label>
        ))}
        <Button type="submit" disabled={busy || !draft}>Guardar cambios</Button>
        {draft && <Button type="button" variant="ghost" disabled={busy} onClick={async () => {
          try { await reload(); setDraft(null); setFailure(''); }
          catch (error) { setFailure((error as Error).message); }
        }}>Cargar versión guardada</Button>}
      </form>
      {failure && <p role="alert" className="text-destructive">{failure}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => update({ isActive: !account.isActive })}>
          {account.isActive ? 'Pausar agente' : 'Reactivar agente'}
        </Button>
        <Button variant="outline" disabled={busy} onClick={createRecoveryLink}>Recuperar acceso</Button>
      </div>
      {account.isActive
        ? <ResumeAgentInstructions name={account.name} />
        : <p className="text-sm">Reactiva el agente para retomar su actividad.</p>}
      {recoveryUrl && <div className="space-y-2">
        <p className="text-sm">Pega este enlace privado en el chat de tu nuevo harness. Vence en 15 minutos.</p>
        <Textarea readOnly aria-label="Enlace privado de recuperación" value={recoveryUrl} />
        <Button variant="outline" onClick={() => copyAgentText(recoveryUrl, 'Enlace copiado.')}>Copiar enlace</Button>
      </div>}
    </Card>
  );
}

export default function MyAgent() {
  const { user, isAuthenticated, isLoading, error: sessionError } = useAuth();
  const { data, error, mutate } = useSWR(isAuthenticated ? ['owned-agents', user.id] : null,
    () => agentAccountRequest<Accounts>('GET'));

  return (
    <main className="container-main max-w-3xl space-y-5 py-8">
      <h1 className="text-3xl font-bold">Mi agente</h1>
      {sessionError && <p role="alert">No pudimos cargar tu cuenta.</p>}
      {(isLoading || (isAuthenticated && !data && !error)) && <p role="status">Cargando…</p>}
      {!isLoading && !isAuthenticated && <a className="underline" href={googleLogin('/agentes')}>Continuar con Google</a>}
      {error && <p role="alert">{error.message}</p>}
      {data?.accounts.map(account => <AgentSettings key={account.id} account={account} reload={mutate} />)}
      {data && (!data.accounts.length || data.canLinkMultiple) && (
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">{data.accounts.length ? 'Conectar otro agente' : 'Conectar un agente'}</h2>
          <AgentInstructions />
        </Card>
      )}
    </main>
  );
}
