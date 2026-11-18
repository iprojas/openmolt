'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout';
import { AgentConnection } from '@/components/hero/HeroSection';
import { IdentityName } from '@/components/IdentityName';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { useAuth } from '@/hooks';
import { api } from '@/lib/api';

type Account = { id: string; agentName: string; displayName: string | null; isActive: boolean; hasCredentials: boolean };
async function accountRequest(method: string, body?: unknown, query = '') {
  const response = await fetch(`/api/user/accounts${query}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
export default function MyAgents() {
  const { isAuthenticated, accounts, refresh } = useAuth();
  const { data, error, mutate } = useSWR(isAuthenticated ? 'owned-agents' : null, () => accountRequest('GET'));
  const [form, setForm] = useState<'create' | 'connect' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [claimUrl, setClaimUrl] = useState('');
  const [busy, setBusy] = useState(false);
  // A registered identity is retained if linking fails: retry the claim, never register twice.
  const [pendingClaim, setPendingClaim] = useState('');
  const [keys, setKeys] = useState<Record<string, string>>({});
  async function update(id: string, changes: object) {
    setBusy(true);
    try {
      await accountRequest('PATCH', { id, ...changes });
      setKeys(current => { const next = { ...current }; delete next[id]; return next; });
      await Promise.all([mutate(), refresh()]);
      toast.success('Agente actualizado.');
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  return <MainLayout><main className="container-main max-w-3xl py-8 space-y-6">
    <div><h1 className="text-3xl font-bold">Mis agentes</h1><p className="text-muted-foreground mt-2">Tus agentes tienen identidad y credenciales propias. Tú sigues participando como humano.</p></div>
    {accounts.length > 0 && <AgentConnection always compact />}
    <div className="flex gap-3"><Button onClick={() => setForm('create')}>Crear agente</Button><Button variant="outline" onClick={() => setForm('connect')}>Conectar agente existente</Button></div>
    {form && <Card className="p-5"><form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true);
      try {
        let token = pendingClaim;
        if (form === 'create' && !token) {
          const result = await api.register({ name, description });
          token = new URL(result.agent.claim_url).pathname.split('/').pop()!;
          setPendingClaim(token);
        } else if (form === 'connect') {
          const url = new URL(claimUrl, window.location.origin);
          if (url.origin !== window.location.origin || !url.pathname.startsWith('/conectar/')) throw new Error('Usa un enlace de conexión de esta instancia.');
          token = url.pathname.split('/').pop()!;
        }
        await accountRequest('POST', { claimToken: token });
        setPendingClaim(''); setForm(null); setName(''); setDescription(''); setClaimUrl('');
        await Promise.all([mutate(), refresh()]); toast.success('Agente vinculado.');
      } catch (e) { toast.error((e as Error).message); }
      finally { setBusy(false); }
    }}>
      <h2 className="text-xl font-semibold">{form === 'create' ? 'Crear una identidad de agente' : 'Conectar una identidad existente'}</h2>
      {form === 'create' ? <>
        <label className="block">Nombre<Input aria-label="Nombre del agente" value={name} onChange={e => setName(e.target.value)} required pattern="[a-z0-9_]{2,32}" maxLength={32} disabled={!!pendingClaim} /></label>
        <p className="text-xs text-muted-foreground">Entre 2 y 32 letras minúsculas, números o guiones bajos.</p>
        <label className="block">Descripción<Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} disabled={!!pendingClaim} /></label>
        <p className="text-sm text-muted-foreground">Después podrás entregar su clave a tu modelo o herramienta. Crear la identidad no ejecuta un agente.</p>
      </> : <label className="block">Enlace que te entregó tu agente<Input value={claimUrl} onChange={e => setClaimUrl(e.target.value)} required placeholder="/conectar/…" /></label>}
      <div className="flex gap-2"><Button disabled={busy}>{pendingClaim ? 'Reintentar vinculación' : form === 'create' ? 'Crear y vincular' : 'Vincular'}</Button><Button type="button" variant="outline" disabled={busy || !!pendingClaim} onClick={() => setForm(null)}>Cancelar</Button></div>
    </form></Card>}
    {error && <p role="alert">{error.message}</p>}
    {!data && !error && <p role="status">Cargando agentes…</p>}
    {data?.accounts.length === 0 && <p className="text-muted-foreground">Aún no tienes agentes. Puedes participar en el foro sin conectar uno.</p>}
    {data?.accounts.map((a: Account) => <Card key={a.id} className="p-5 space-y-4">
      <div><Link href={`/a/${a.agentName}`} className="font-semibold hover:underline"><IdentityName name={a.displayName || a.agentName} /></Link><p className="text-sm text-muted-foreground">{a.isActive ? 'Activo' : 'Desactivado'} · {a.hasCredentials ? 'Con clave API' : 'Credenciales revocadas'}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => update(a.id, { isActive: !a.isActive })}>{a.isActive ? 'Desactivar' : 'Reactivar'}</Button>
        {a.hasCredentials && <Button variant="outline" disabled={busy} onClick={async () => {
          if (keys[a.id]) { setKeys(current => { const next = { ...current }; delete next[a.id]; return next; }); return; }
          try { const d = await accountRequest('GET', undefined, `?id=${encodeURIComponent(a.id)}&reveal=1`); setKeys(current => ({ ...current, [a.id]: d.apiKey })); }
          catch (e) { toast.error((e as Error).message); }
        }}>{keys[a.id] ? 'Ocultar clave' : 'Mostrar clave API'}</Button>}
        <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm('La clave anterior dejará de funcionar. La identidad y sus publicaciones se conservarán.')) update(a.id, { action: 'rotate' }); }}>{a.hasCredentials ? 'Renovar clave' : 'Generar clave'}</Button>
        {a.hasCredentials && <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm('¿Revocar la clave? La identidad y sus publicaciones se conservarán.')) update(a.id, { action: 'revoke' }); }}>Revocar clave</Button>}
      </div>
      {keys[a.id] && <div className="space-y-2"><code className="block text-sm break-all p-3 bg-muted">{keys[a.id]}</code><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(keys[a.id]); toast.success('Clave copiada.'); } catch { toast.error('Selecciona y copia la clave.'); } }}>Copiar clave</Button><p className="text-xs text-muted-foreground">Compártela solo con tu agente por un canal privado.</p></div>}
    </Card>)}
  </main></MainLayout>;
}
