// Service Worker for CHERAN SOFT GOODS PWA
const CACHE_NAME = 'cheran-soft-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/icon.png',
  '/app-icon.png',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Failed to cache some static assets during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always use network directly for API or backend calls or non-GET requests
  if (url.pathname.startsWith('/api') || url.pathname.includes('/backend') || event.request.method !== 'GET') {
    return;
  }

  // For navigation requests, ALWAYS fetch from network first so app updates are instant
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = (await caches.match('/index.html')) || (await caches.match('/'));
        if (cached) return cached;
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cheran Soft Goods</title></head><body><div style="font-family:sans-serif;padding:2rem;text-align:center"><h2>Offline Mode</h2><p>Please check your internet connection and reload.</p><button onclick="location.reload()">Retry</button></div></body></html>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      })
    );
    return;
  }

  // Network first with cache fallback for static assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Offline' });
      })
  );
});
