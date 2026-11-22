function destination(path) {
  const url = new URL(typeof path === 'string' ? path : '/', self.location.origin);
  return url.origin === self.location.origin ? url.href : self.location.origin;
}

self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { payload = {}; }
  event.waitUntil(self.registration.showNotification('CHILE2', {
    body: 'Tienes una notificación nueva.',
    icon: '/chile2-192.png',
    tag: payload?.tag,
    data: { url: payload?.url },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(destination(event.notification.data?.url)));
});
