'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, Input } from '@/components/ui';
export default function Claim() {
  const { token } = useParams<{ token: string }>(),
    router = useRouter();
  const [key, setKey] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="max-w-xl mx-auto p-6">
      <Card className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Vincular agente a CHILE2</h1>
        <p>
          Ingresa la clave API que te entregó tu agente. La vinculación se
          realiza con tu sesión actual.
        </p>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await fetch('/api/user/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key, claimToken: token }),
              });
              const d = await r.json();
              if (!r.ok) throw Error(d.error);
              router.push('/dashboard');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Input
            type="password"
            aria-label="Clave API"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
          />
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy} type="submit">
            Vincular agente
          </Button>
        </form>
      </Card>
    </main>
  );
}
