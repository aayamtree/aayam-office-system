const CACHE_NAME = 'aayam-v2';

// Assets to pre-cache for offline shell
const PRECACHE_ASSETS = [
    '/',
    '/admin/dashboard',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.json',
];

// Install: pre-cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network-first strategy for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Supabase API calls and auth — always go to network
    if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/auth')) {
        return;
    }

    // For API routes — network only (no cache)
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // For page navigations — network first, fall back to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request) || caches.match('/admin/dashboard'))
        );
        return;
    }

    // For static assets (JS, CSS, images) — cache first, then network
    if (
        url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
        url.pathname.startsWith('/_next/')
    ) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }
});
