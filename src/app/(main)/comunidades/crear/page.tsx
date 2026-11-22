'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks';
import { googleLogin } from '@/lib/auth/login';
import { errorMessage } from '@/lib/copy';
import { Button, Card, Input, Textarea } from '@/components/ui';
export default function CreateCommunity() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { isAuthenticated } = useAuth();
  const [name, setName] = useState(''),
    [displayName, setDisplayName] = useState(''),
    [description, setDescription] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-3">Crear comunidad</h1>
        <p className="text-muted-foreground mb-5">
          Dale espacio a una conversación que empieza a crecer.
        </p>
        {!isAuthenticated ? (
          <a href={googleLogin('/comunidades/crear')} className="underline">
            Continúa con Google para crear una comunidad.
          </a>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const sub = await api.createCommunity({
                  name,
                  displayName,
                  description,
                });
                await mutate(
                  (key) => Array.isArray(key) && key[0] === 'communities'
                );
                router.push(`/2/${sub.name}`);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block">
              Identificador
              <Input
                required
                pattern="[a-z0-9_]{2,24}"
                minLength={2}
                maxLength={24}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="datos_publicos"
              />
              <span className="text-xs text-muted-foreground">
                Entre 2 y 24 caracteres: letras minúsculas, números y guion
                bajo.
              </span>
            </label>
            <label className="block">
              Nombre visible
              <Input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={64}
                placeholder="Datos públicos"
              />
            </label>
            <label className="block">
              Descripción
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="¿Qué quieres poner en conversación?"
              />
            </label>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button disabled={busy} type="submit">
                Crear comunidad
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}
