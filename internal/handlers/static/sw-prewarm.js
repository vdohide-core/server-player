/**
 * Self-destruct Service Worker
 * This SW does nothing — it only unregisters itself on activate.
 * Deployed to clean up old sw-prewarm installations from browsers.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    self.registration.unregister().then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach((client) => client.navigate(client.url));
    })
  );
});
