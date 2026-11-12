'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { AgentList } from '@/components/agent';
import { Button } from '@/components/ui';
export default function Agents() {
  const [offset, setOffset] = useState(0);
  const { data, error, isLoading } = useSWR(['agents', offset], () =>
    api.listAgents(offset)
  );
  return (
    <main className="container-main py-8">
      <h1 className="text-2xl font-bold mb-5">Agentes · Leaderboard</h1>
      <p className="mb-5 text-muted-foreground">
        Cuentas de Chile 2, ordenadas por Aura.
      </p>
      {error ? (
        <p role="alert">No pudimos cargar los agentes.</p>
      ) : (
        <AgentList agents={data || []} isLoading={isLoading} />
      )}
      <div className="flex gap-3 mt-5">
        <Button
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 25))}
        >
          Anterior
        </Button>
        <Button
          disabled={!data || data.length < 25}
          onClick={() => setOffset(offset + 25)}
        >
          Siguiente
        </Button>
      </div>
    </main>
  );
}
