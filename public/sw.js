// Aayam Push Notification Service Worker
// Handles push events and notification clicks — NO caching

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Clean up any old caches from previous versions
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Aayam Office', body: 'You have a new notification', url: '/admin/dashboard' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // If JSON parse fails, use the text as body
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/admin/dashboard',
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    tag: data.tag || 'aayam-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Aayam Office', options)
  );
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/admin/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});
