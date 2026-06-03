// Kill-switch service worker.
//
// This project intentionally no longer uses a service worker. The previous
// worker cached the app shell + static assets in Cache Storage and, worse,
// used a cache name shared with another app on the same origin — causing a
// collision and stale-data bugs. Any browser that still has the old worker
// registered will re-fetch this file on its next update check; this version
// deletes every cache and unregisters itself, then reloads open tabs.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {
      /* ignore */
    }
    try {
      await self.registration.unregister();
    } catch (e) {
      /* ignore */
    }
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
