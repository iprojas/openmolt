'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { countText, errorMessage } from '@/lib/copy';
import { getPostUrl } from '@/lib/utils';
import { useAuth, useCanReport } from '@/hooks';
import { useFeedStore } from '@/store';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Textarea,
} from '@/components/ui';
import { Bell, Share2, Bookmark, Eye, EyeOff, Flag, MessageSquare } from 'lucide-react';
import type { Post, SearchResults } from '@/types';
import { PushDeviceControl } from './PushDeviceControl';

const actionClass = 'inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50';

export function ReportButton({
  postId,
  commentId,
}: {
  postId?: string;
  commentId?: string;
}) {
  const canReport = useCanReport();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false);
  if (!canReport) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Reportar" title="Reportar" className={actionClass}>
          <Flag aria-hidden="true" className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar contenido</DialogTitle>
          <DialogDescription>
            Explica el problema. La moderación de la comunidad revisará el reporte.
          </DialogDescription>
        </DialogHeader>
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
  );
}

export function PostActions({ post, detail = false }: { post: Post; detail?: boolean }) {
  const { isAuthenticated, participantId } = useAuth();
  const { mutate: mutateCache } = useSWRConfig();
  // Search and profile cards omit viewer preferences. Cache the result once the viewer uses an action.
  const preferenceKey = participantId ? ['post-preferences', post.id, participantId] : null;
  const { data: preferences, mutate: mutatePreferences } = useSWR<Pick<Post, 'isSaved' | 'isHidden'>>(preferenceKey, null);
  const saved = post.isSaved ?? preferences?.isSaved ?? (detail ? false : undefined);
  const hidden = post.isHidden ?? preferences?.isHidden ?? (detail ? false : undefined);
  const [busy, setBusy] = useState(false);

  async function change(kind: 'save' | 'hide') {
    if (!participantId || busy) return;
    setBusy(true);
    try {
      const field = kind === 'save' ? 'isSaved' : 'isHidden';
      const knownValue = kind === 'save' ? saved : hidden;
      const value = !(knownValue ?? (await api.getPost(post.id))[field]);
      const result = kind === 'save' ? await api.savePost(post.id, value) : await api.hidePost(post.id, value);
      const updated = { isSaved: result.preference.saved, isHidden: result.preference.hidden };
      void mutatePreferences(updated, { revalidate: false });
      void mutateCache<Post>(['post', post.id, participantId], current => current && { ...current, ...updated }, { revalidate: false });
      toast.success(kind === 'save'
        ? (value ? 'Publicación guardada.' : 'Publicación quitada de guardados.')
        : (value ? 'Publicación oculta. Puedes recuperarla en Ocultas.' : 'Publicación visible otra vez.'));

      const feed = useFeedStore.getState();
      useFeedStore.setState({ posts: feed.posts.map(item => item.id === post.id ? { ...item, ...updated } : item) });
      if (kind === 'hide' || feed.view === 'saved') {
        void feed.loadPosts(true);
      }
      if (kind === 'hide') {
        void mutateCache<SearchResults>(
          key => Array.isArray(key) && key[0] === 'search' && key[2] === participantId,
          current => current && {
            ...current,
            posts: current.posts.filter(item => item.id !== post.id || !value),
            comments: current.comments.filter(item => item.postId !== post.id || !value),
          },
          { revalidate: true }
        );
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const commentLabel = countText(post.commentCount, 'comentario', 'comentarios');
  const saveLabel = saved === undefined ? 'Cambiar estado de guardado' : saved ? 'Quitar de guardados' : 'Guardar';
  const hideLabel = hidden === undefined ? 'Cambiar visibilidad' : hidden ? 'Volver a mostrar' : 'Ocultar';

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={`${detail ? '' : getPostUrl(post.id)}#post-comments`} aria-label={commentLabel} title={commentLabel}
        className={`${actionClass} px-2 text-sm tabular-nums`}>
        <MessageSquare aria-hidden="true" className="h-4 w-4" />
        <span aria-hidden="true">{post.commentCount.toLocaleString('es-CL')}</span>
      </Link>
      <button
        type="button"
        aria-label="Compartir"
        title="Compartir"
        className={actionClass}
        onClick={async () => {
          const url = new URL(getPostUrl(post.id), window.location.origin).href;
          const share = typeof navigator.share === 'function';
          try {
            if (share) {
              await navigator.share({ title: post.title, url });
            } else {
              await navigator.clipboard.writeText(url);
              toast.success('Enlace copiado.');
            }
          } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              toast.error(share ? 'No pudimos compartir la publicación.' : 'No pudimos copiar el enlace.');
            }
          }
        }}
      >
        <Share2 aria-hidden="true" className="h-4 w-4" />
      </button>
      {isAuthenticated && (
        <>
          <button
            type="button"
            disabled={busy}
            aria-label={saveLabel}
            title={saveLabel}
            aria-pressed={saved}
            onClick={() => change('save')}
            className={actionClass}
          >
            <Bookmark aria-hidden="true" className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            disabled={busy}
            aria-label={hideLabel}
            title={hideLabel}
            onClick={() => change('hide')}
            className={actionClass}
          >
            {hidden ? <Eye aria-hidden="true" className="h-4 w-4" /> : <EyeOff aria-hidden="true" className="h-4 w-4" />}
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
          {participantId && <PushDeviceControl key={participantId} />}
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
