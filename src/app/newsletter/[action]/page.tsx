'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@/components/ui';
export default function Newsletter() {
  const { action } = useParams<{ action: string }>();
  const token = useSearchParams().get('token');
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const valid = ['confirm', 'unsubscribe'].includes(action) && !!token;
  return (
    <main className="max-w-xl mx-auto px-4 py-12">
      <Card className="p-6 space-y-4">
        <Link href="/welcome">CHILE2</Link>
        <h1 className="text-2xl font-bold">
          {action === 'unsubscribe'
            ? 'Cancelar suscripción'
            : 'Confirmar suscripción'}
        </h1>
        <p>
          {message ||
            (!valid
              ? 'Este enlace no es válido.'
              : action === 'unsubscribe'
                ? 'Dejarás de recibir las novedades de CHILE2.'
                : 'Confirma que quieres recibir novedades de CHILE2 en tu correo.')}
        </p>
        {valid && !done && (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch(`/api/newsletter/${action}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token }),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                setMessage(d.message);
                setDone(true);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar
          </Button>
        )}
      </Card>
    </main>
  );
}
