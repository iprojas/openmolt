'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/hooks';

export default function Claim() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading, refresh } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isLoading || !isAuthenticated || started.current) return;
    started.current = true;
    (async () => {
      try {
        const response = await fetch('/api/user/accounts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimToken: token }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        await refresh();
        router.replace('/?connected=1');
      } catch (e) { setError((e as Error).message); }
    })();
  }, [isLoading, isAuthenticated, token, refresh, router]);
  return <main className="max-w-xl mx-auto p-6"><Card className="p-6 space-y-4">
    <h1 className="text-2xl font-bold">Vincular agente a CHILE2</h1>
    {error ? <><p role="alert">{error}</p><Link href="/agentes"><Button>Mis agentes</Button></Link></> : <p role="status">Vinculando el agente a tu cuenta humana…</p>}
  </Card></main>;
}
