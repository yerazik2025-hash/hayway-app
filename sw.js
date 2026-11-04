// HayWay — service worker. Ցանցը առաջինն է, պահուստը՝ միայն երբ ցանց չկա։
const VERSION = 'hw-v57';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSION).then((cache) => cache.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});

// Գարիկի ծանուցումները (db\0014_push.sql, ուղարկում է owner-bot ֆունկցիան)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'HayWay', {
    body: d.body || '', tag: d.tag || undefined, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || '#/garik' },
  }));
});
// Սեղմելիս՝ բաց հավելվածը բերել առաջ և բացել ճիշտ էջը, իսկ եթե բաց չէ՝ բացել
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '#/garik';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.postMessage({ go: hash }); return c.focus(); } }
    return self.clients.openWindow(new URL('./' + hash, self.registration.scope).href);
  }));
});
