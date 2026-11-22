'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { pushDeviceId, removePushDevice, supportsWebPush } from '@/lib/web-push';

type Device = {
  registration: ServiceWorkerRegistration;
  publicKey: string;
  subscription: PushSubscription | null;
  enabled: boolean;
};

export function PushDeviceControl() {
  const [device, setDevice] = useState<Device | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function prepare() {
      const config = await api.pushConfig();
      if (!config.publicKey || !mounted) return;
      const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isAppleMobile && !window.matchMedia('(display-mode: standalone)').matches &&
          !(navigator as Navigator & { standalone?: boolean }).standalone) {
        setMessage('En iPhone o iPad, añade CHILE2 a la pantalla de inicio y ábrelo desde allí para activar los avisos.');
        return;
      }
      if (!supportsWebPush()) return;
      await navigator.serviceWorker.register('/push-worker.js');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const enabled = !!subscription && config.devices.includes(await pushDeviceId(subscription.endpoint));
      if (mounted) setDevice({ registration, publicKey: config.publicKey, subscription, enabled });
    }
    void prepare().catch(() => {
      if (mounted) setMessage('Los avisos de este dispositivo no están disponibles.');
    });
    return () => { mounted = false; };
  }, []);

  async function toggle() {
    if (!device) return;
    setBusy(true);
    setMessage('');
    let subscription = device.subscription;
    try {
      if (device.enabled && subscription) {
        await removePushDevice(subscription);
        setDevice({ ...device, subscription: null, enabled: false });
        return;
      }
      // Keep subscribe on the direct click path for browsers that require user activation.
      subscription ??= await device.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: device.publicKey,
      });
      try {
        await api.subscribePush(subscription.toJSON());
      } catch (error) {
        await subscription.unsubscribe().catch(() => {});
        setDevice({ ...device, subscription: null });
        throw error;
      }
      setDevice({ ...device, subscription, enabled: true });
    } catch (error) {
      if ('Notification' in window && Notification.permission === 'denied') {
        setMessage('El permiso está bloqueado. Puedes cambiarlo en los ajustes del navegador.');
      } else {
        toast.error(error instanceof Error && error.name === 'ApiError'
          ? error.message
          : 'No pudimos cambiar los avisos de este dispositivo.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!device && !message) return null;
  return (
    <div className="mb-2 border-b pb-2 text-xs">
      {device && <button type="button" disabled={busy} onClick={toggle}
        className="py-1 text-primary underline disabled:opacity-50">
        {device.enabled ? 'Desactivar avisos en este dispositivo' : 'Activar avisos en este dispositivo'}
      </button>}
      {message && <p role="status" className="text-muted-foreground">{message}</p>}
    </div>
  );
}
