'use client';
import { useState, useEffect } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/copy';
import { useAuth } from '@/hooks';
import { useFeedStore } from '@/store';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@/components/ui';
import { Bell, Share2, Bookmark, Eye, EyeOff, Flag } from 'lucide-react';
import type { Post } from '@/types';

export function ReportButton({
  postId,
  commentId,
}: {
  postId?: string;
  commentId?: string;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Reportar"
        title="Reportar"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Flag aria-hidden="true" className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar contenido</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Explica el problema. La moderación de la comunidad revisará el reporte.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api.report({ postId, commentId, reason });
                toast.success(
                  'Reporte recibido por la moderación de la comunidad.'
                );
                setOpen(false);
                setReason('');
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-3"
          >
            <Textarea
              aria-label="Motivo del reporte"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              required
            />
            <Button disabled={busy || !reason.trim()} type="submit">
              Enviar reporte
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function PostActions({ post }: { post: Post }) {
  const { isAuthenticated } = useAuth();
  const { mutate } = useSWRConfig();
  const [saved, setSaved] = useState(!!post.isSaved),
    [busy, setBusy] = useState(false);
  useEffect(() => setSaved(!!post.isSaved), [post.isSaved]);
  async function change(kind: 'save' | 'hide') {
    setBusy(true);
    try {
      if (kind === 'save') {
        await api.savePost(post.id, !saved);
        setSaved(!saved);
        toast.success(
          saved ? 'Publicación quitada de guardados.' : 'Publicación guardada.'
        );
      } else {
        await api.hidePost(post.id, !post.isHidden);
        toast.success(
          post.isHidden
            ? 'Publicación visible otra vez.'
            : 'Publicación oculta. Puedes recuperarla en Ocultas.'
        );
        await useFeedStore.getState().loadPosts(true);
      }
      await mutate(
        (key) => Array.isArray(key) && key[0] === 'post' && key[1] === post.id
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
      <button
        aria-label="Compartir"
        title="Compartir"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-muted hover:text-foreground disabled:opacity-50"
        onClick={async () => {
          try {
            const url = `${window.location.origin}/post/${post.id}`;
            if (navigator.share)
              await navigator.share({ title: post.title, url });
            else {
              await navigator.clipboard.writeText(url);
              toast.success('Enlace copiado. Que siga la conversación.');
            }
          } catch (err) {
            if ((err as Error).name !== 'AbortError')
              toast.error(
                'No pudimos copiar el enlace. Puedes copiarlo desde la barra de direcciones.'
              );
          }
        }}
      >
        <Share2 aria-hidden="true" className="h-4 w-4" />
      </button>
      {isAuthenticated && (
        <>
          <button
            disabled={busy}
            aria-label={saved ? 'Quitar de guardados' : 'Guardar'}
            title={saved ? 'Quitar de guardados' : 'Guardar'}
            aria-pressed={saved}
            onClick={() => change('save')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <Bookmark aria-hidden="true" className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          </button>
          <button
            disabled={busy}
            aria-label={post.isHidden ? 'Volver a mostrar' : 'Ocultar'}
            title={post.isHidden ? 'Volver a mostrar' : 'Ocultar'}
            onClick={() => change('hide')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {post.isHidden ? <Eye aria-hidden="true" className="h-4 w-4" /> : <EyeOff aria-hidden="true" className="h-4 w-4" />}
          </button>
          <ReportButton postId={post.id} />
        </>
      )}
    </div>
  );
}
export function NotificationBell() {
  const { participantId } = useAuth();
  const [open, setOpen] = useState(false);
  const { data, error, mutate } = useSWR(
    participantId ? ['notifications', participantId] : null,
    () => api.notifications(),
    { refreshInterval: 20000 }
  );
  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {data?.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full px-1">
            {data.unreadCount}
          </span>
        )}
      </Button>
      {open && (
        <section
          aria-label="Bandeja de notificaciones"
          className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-full z-50 w-[min(22rem,calc(100vw-1rem))] max-h-[65vh] overflow-y-auto rounded border bg-popover p-3 shadow-lg"
        >
          <div className="flex justify-between gap-2 mb-3">
            <strong>Notificaciones</strong>
            <button
              className="text-xs underline"
              onClick={async () => {
                try {
                  await api.readNotifications();
                  await mutate();
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              Marcar todas leídas
            </button>
          </div>
          {error ? (
            <p>No pudimos cargar los avisos.</p>
          ) : !data ? (
            <p>Cargando…</p>
          ) : !data.notifications.length ? (
            <p className="text-sm text-muted-foreground">
              Sin novedades por ahora.
            </p>
          ) : (
            data.notifications.map((n: any) => (
              <Link
                key={n.id}
                href={n.link}
                className={`block border-t py-3 text-sm ${n.read ? 'text-muted-foreground' : 'font-semibold'}`}
                onClick={async () => {
                  setOpen(false);
                  try {
                    await api.readNotifications(n.id);
                    await mutate();
                  } catch {
                    toast.error('No pudimos marcar el aviso como leído.');
                  }
                }}
              >
                {n.title}
                <span className="block font-normal">{n.body}</span>
              </Link>
            ))
          )}
        </section>
      )}
    </div>
  );
}
