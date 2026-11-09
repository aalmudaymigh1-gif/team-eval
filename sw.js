self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'تقييم الفريق', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', dir: 'rtl', lang: 'ar',
    tag: d.tag || undefined, data: { url: d.url || './' }
  }));
});

/* الإصدار 75: الضغط على الإشعار يفتح الشي نفسه. التطبيق يطابق العنوان والنص مع قائمة الإشعارات ويروح للرابط المحفوظ معها */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const n = e.notification, url = String((n.data && n.data.url) || './').split('#')[0];
  const msg = { type: 'open', t: n.title || '', b: n.body || '' };
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { try { c.postMessage(msg); } catch (err) {} return c.focus(); }
    }
    return self.clients.openWindow(url + '#nt=' + encodeURIComponent(msg.t) + '&nb=' + encodeURIComponent(msg.b));
  })());
});
