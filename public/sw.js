/**
 * KILL SWITCH SERVICE WORKER
 * Purpose: Forcefully clear all caches and unregister to fix blank screen issues.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      console.log('SW Kill Switch Success: Caches cleared and SW unregistered');
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach(client => client.navigate(client.url));
    })
  );
});

// Immediately take control
self.addEventListener('fetch', (event) => {
  // No-op, just bypass cache
  return;
});
