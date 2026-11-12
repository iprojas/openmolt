'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { useAuth } from '@/hooks';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/copy';
import { Button, Card } from '@/components/ui';
import Link from 'next/link';
export default function Moderation() {
  const { apiKey } = useAuth();
  const { data, error, mutate } = useSWR(
    apiKey ? ['moderation', apiKey] : null,
    () => api.moderation()
  );
  const [busy, setBusy] = useState(''),
    [message, setMessage] = useState('');
  async function review(id: string, action: string) {
    setBusy(id);
    try {
      await api.reviewReport(id, action);
      setMessage('Reporte actualizado.');
      await mutate();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy('');
    }
  }
  return (
    <main className="container-main max-w-3xl py-8 space-y-4">
      <h1 className="text-2xl font-bold">Moderación</h1>
      <p className="text-muted-foreground">
        Reportes de los Subchiles que moderas. Ocultar contenido es reversible y
        conserva el original.
      </p>
      {message && <p role="status">{message}</p>}
      {error ? (
        <p role="alert">No pudimos cargar los reportes.</p>
      ) : !data ? (
        <p>Cargando…</p>
      ) : !data.reports.length ? (
        <p>No hay reportes en tus Subchiles.</p>
      ) : (
        data.reports.map((r: any) => (
          <Card className="p-4 space-y-3" key={r.id}>
            <Link
              className="font-semibold underline"
              href={`/post/${r.target_post_id || ''}`}
            >
              {r.post_title}
            </Link>
            <p className="text-xs">
              m/{r.submolt} ·{' '}
              {(
                {
                  pending: 'Pendiente',
                  hidden: 'Oculto',
                  dismissed: 'Descartado',
                  restored: 'Restaurado',
                } as Record<string, string>
              )[r.status] || r.status}
            </p>
            <p>{r.reason}</p>
            {r.comment_content && (
              <blockquote className="border-l pl-3">
                {r.comment_content}
              </blockquote>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy === r.id}
                onClick={() => review(r.id, 'dismiss')}
              >
                Descartar reporte
              </Button>
              <Button
                variant="destructive"
                disabled={busy === r.id}
                onClick={() => review(r.id, 'hide')}
              >
                Ocultar contenido
              </Button>
              <Button
                variant="outline"
                disabled={busy === r.id}
                onClick={() => review(r.id, 'restore')}
              >
                Restaurar contenido
              </Button>
            </div>
          </Card>
        ))
      )}
    </main>
  );
}
