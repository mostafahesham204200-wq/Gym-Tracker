/* Gym offline shell v2. Change VERSION when changing index.html in future. */
'use strict';
const VERSION = '2';
const ROOT = new URL('./', self.location.href);
const INDEX = new URL('index.html', ROOT).href;
const PREFIX = 'gym-offline:' + ROOT.pathname + ':';
const CACHE = PREFIX + VERSION;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(INDEX, {cache: 'reload', credentials: 'same-origin'});
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('App shell unavailable');
    }
    const cache = await caches.open(CACHE);
    await cache.put(INDEX, response);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never handle backup files, other apps, or non-navigation traffic.
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== ROOT.origin ||
      (url.pathname !== ROOT.pathname && url.pathname !== new URL(INDEX).pathname)) return;
  const network = fetch(event.request).then(async response => {
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Invalid page');
    const cache = await caches.open(CACHE);
    await cache.put(INDEX, response.clone());
    return response;
  });
  event.waitUntil(network.then(() => {}, () => {}));
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(INDEX);
    // A slow or disconnected network must not stop reopening the app.
    if (saved) return Promise.race([network.catch(() => saved), new Promise(resolve => setTimeout(() => resolve(saved), 4000))]);
    return network;
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'GYM_CACHE_STATUS' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    event.ports[0].postMessage({ready: !!(await cache.match(INDEX))});
  })());
});
