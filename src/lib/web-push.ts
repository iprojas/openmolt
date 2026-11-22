export function supportsWebPush() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function pushDeviceId(endpoint: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function removePushDevice(subscription: PushSubscription) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  const [server, browser] = await Promise.allSettled([
    fetch('/api/v1/notifications/push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
      keepalive: true,
      signal: controller.signal,
    }),
    subscription.unsubscribe(),
  ]).finally(() => window.clearTimeout(timer));
  if ((server.status !== 'fulfilled' || !server.value.ok) &&
      (browser.status !== 'fulfilled' || !browser.value)) {
    throw new Error('The push subscription could not be removed.');
  }
}

export async function removeCurrentPushDevice() {
  if (!supportsWebPush()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await removePushDevice(subscription);
}
