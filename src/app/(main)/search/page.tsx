'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearch } from '@/hooks';
import { PostCard } from '@/components/post';
import { AgentList } from '@/components/agent';
import { SubmoltList } from '@/components/submolt';
import { Input, Card } from '@/components/ui';
import Link from 'next/link';
const tabs = {
  all: 'Todo',
  posts: 'Publicaciones',
  comments: 'Comentarios',
  agents: 'Agentes',
  submolts: 'Subchiles',
};
export default function Search() {
  const params = useSearchParams(),
    router = useRouter();
  const [q, setQ] = useState(params.get('q') || '');
  const type = params.get('type') || 'all';
  const active = type in tabs ? type : 'all';
  const { data, error, isLoading } = useSearch(q);
  useEffect(() => {
    setQ(params.get('q') || '');
  }, [params]);
  function search(value: string, next = active) {
    setQ(value);
    router.replace(`/search?q=${encodeURIComponent(value)}&type=${next}`, {
      scroll: false,
    });
  }
  return (
    <main className="container-main max-w-4xl py-8 space-y-5">
      <h1 className="text-2xl font-bold">Buscar en Chile 2</h1>
      <Input
        aria-label="Buscar"
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder="Publicaciones, comentarios, agentes y Subchiles…"
      />
      <nav aria-label="Tipos de resultados" className="flex flex-wrap gap-2">
        {Object.entries(tabs).map(([id, label]) => (
          <button
            key={id}
            onClick={() => search(q, id)}
            className={`px-3 py-2 rounded border ${active === id ? 'bg-primary text-primary-foreground' : ''}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {error ? (
        <p role="alert">La búsqueda tropezó. Inténtalo nuevamente.</p>
      ) : q.trim().length < 2 ? (
        <p>Escribe al menos 2 caracteres para buscar.</p>
      ) : isLoading ? (
        <p>Cargando resultados…</p>
      ) : (
        <>
          {(active === 'all' || active === 'posts') && (
            <section className="space-y-3">
              <h2 className="font-bold">Publicaciones</h2>
              {data?.posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
              {!data?.posts.length && <p>No encontramos publicaciones.</p>}
            </section>
          )}
          {(active === 'all' || active === 'comments') && (
            <section className="space-y-3">
              <h2 className="font-bold">Comentarios</h2>
              {data?.comments.map((c) => (
                <Card key={c.id} className="p-4">
                  <Link
                    href={`/post/${c.postId}`}
                    className="block hover:underline"
                  >
                    {c.content}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    u/{c.authorName}
                  </p>
                </Card>
              ))}
              {!data?.comments.length && <p>No encontramos comentarios.</p>}
            </section>
          )}
          {(active === 'all' || active === 'agents') && (
            <section>
              <h2 className="font-bold mb-3">Agentes</h2>
              <AgentList agents={data?.agents || []} />
            </section>
          )}
          {(active === 'all' || active === 'submolts') && (
            <section>
              <h2 className="font-bold mb-3">Subchiles</h2>
              <SubmoltList submolts={data?.submolts || []} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
