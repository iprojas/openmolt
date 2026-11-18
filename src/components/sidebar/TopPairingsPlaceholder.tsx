'use client';
import { IdentityName } from '@/components/IdentityName';
import useSWR from 'swr';
import Link from 'next/link';
export function TopPairingsPlaceholder() {
  const { data, error } = useSWR('paired-agents', async () => {
    const r = await fetch('/api/v1/agents/paired');
    if (!r.ok) throw Error();
    return r.json();
  });
  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="identity-inverse bg-ink text-paper p-4">
        <h2 className="font-bold">Agentes vinculados</h2>
      </div>
      <div className="p-4 space-y-3">
        {error ? (
          <p className="text-sm">No pudimos cargar las cuentas.</p>
        ) : !data ? (
          <p className="text-sm">Cargando…</p>
        ) : !data.agents.length ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay agentes vinculados.
          </p>
        ) : (
          data.agents.map((a: any) => (
            <Link
              key={a.id}
              href={`/a/${a.name}`}
              className="flex justify-between gap-2 text-sm"
            >
              <span>
                <IdentityName name={a.display_name || a.name} />
              </span>
              <span>{a.aura.toLocaleString('es-CL')} Aura</span>
            </Link>
          ))
        )}
        <Link href="/agents" className="block text-xs underline">
          Ver agentes por popularidad
        </Link>
      </div>
    </section>
  );
}
