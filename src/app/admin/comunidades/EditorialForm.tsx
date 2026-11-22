'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button, Card, Textarea } from '@/components/ui';
import { editorialFields, type EditorialCommunity, type EditorialFields } from '@/lib/community-editorial';
import { WELCOME_COMMUNITY } from '@/lib/community-slugs';

async function editorialRequest(path: string, values?: EditorialFields): Promise<EditorialCommunity> {
  const response = await fetch(path, values ? {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
    cache: 'no-store',
  } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No pudimos cargar la edición.');
  return data.community;
}

export function EditorialForm({ communities }: {
  communities: { name: string; displayName: string | null }[];
}) {
  const [name, setName] = useState(
    communities.find(community => community.name === WELCOME_COMMUNITY)?.name ?? communities[0]?.name ?? ''
  );
  const path = name ? `/api/v1/admin/communities/${encodeURIComponent(name)}` : null;
  const { data, error, mutate } = useSWR(path, (url: string) => editorialRequest(url));
  const [draft, setDraft] = useState<EditorialFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const values = draft ?? data;

  async function save() {
    if (!path || !draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await editorialRequest(path, draft);
      await mutate(updated, { revalidate: false });
      setDraft(null);
      setMessage({ error: false, text: 'Cambios guardados.' });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'No pudimos guardar los cambios.' });
    } finally {
      setSaving(false);
    }
  }

  if (!path) return <p>No hay comunidades disponibles.</p>;

  return (
    <Card className="p-5">
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="block space-y-1">
          <span>Comunidad</span>
          <select className="block w-full rounded-md border bg-background p-2" value={name} disabled={saving}
            onChange={event => { setName(event.target.value); setDraft(null); setMessage(null); }}>
            {communities.map(community => (
              <option key={community.name} value={community.name}>{community.displayName || community.name}</option>
            ))}
          </select>
        </label>
        {error && <p role="alert">{error.message}</p>}
        {!values && !error && <p role="status">Cargando…</p>}
        {values && <>
          {editorialFields.map(({ key, label, max }) => (
            <label key={key} className="block space-y-1">
              <span>{label}</span>
              <Textarea value={values[key] ?? ''} maxLength={max} disabled={saving}
                rows={key === 'description' ? 3 : 7}
                onChange={event => setDraft({
                  description: values.description,
                  editorial_text: values.editorial_text,
                  agent_guidance: values.agent_guidance,
                  [key]: event.target.value,
                })} />
            </label>
          ))}
          <Button type="submit" disabled={!draft || saving}>Guardar cambios</Button>
        </>}
        {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
      </form>
    </Card>
  );
}
