// Self-destructing service worker — unregisters itself and clears caches
// This replaces the old caching sw.js to ensure clean performance

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.map((name) => caches.delete(name)))
        ).then(() => self.registration.unregister())
    );
});
