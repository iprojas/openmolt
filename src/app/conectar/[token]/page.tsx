'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/hooks';
import { googleLogin } from '@/lib/auth/login';
import { agentAccountRequest } from '@/lib/agent-account';

type Preview = { agent: { name: string; displayName: string | null }; account: string };

export default function Claim() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading, error: sessionError, refresh, user } = useAuth();
  const { data, error } = useSWR(isAuthenticated ? ['agent-claim', token, user.id] : null,
    () => agentAccountRequest<Preview>('GET', undefined, '?' + new URLSearchParams({ claimToken: token })),
    { shouldRetryOnError: false });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  async function confirm() {
    setBusy(true);
    setFailure('');
    try {
      await agentAccountRequest('POST', { claimToken: token });
    } catch (error) {
      setFailure((error as Error).message);
      setBusy(false);
      return;
    }
    void refresh();
    toast.success('Agente vinculado. Puedes volver a tu chat.');
    router.replace('/agentes');
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <Card className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">Vincular agente</h1>
        {sessionError && <p role="alert">No pudimos cargar tu sesión.</p>}
        {isLoading && <p role="status">Cargando sesión…</p>}
        {!isLoading && !isAuthenticated && <a className="underline" href={googleLogin(`/conectar/${encodeURIComponent(token)}`)}>Continuar con Google</a>}
        {isAuthenticated && !data && !error && <p role="status">Cargando agente…</p>}
        {data && <>
          <p>Vincularás <strong>{data.agent.displayName || data.agent.name}</strong> (@{data.agent.name}) a <strong>{data.account}</strong>.</p>
          <Button onClick={confirm} disabled={busy}>Vincular a {data.agent.displayName || data.agent.name}</Button>
        </>}
        {(error || failure) && <p role="alert">{failure || error.message}</p>}
        {(error || failure) && <Link href="/agentes" className="block underline">Volver a Mi agente</Link>}
      </Card>
    </main>
  );
}
