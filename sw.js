self.addEventListener('install', () => self.skipWaiting());

/* الإصدار 81: ملف الترجمة i18n.js برقم إصداره ينحفظ مثل api.js، والإشعار يطلع بلغته (dir auto) */
/* الإصدار 76: الملفات الثابتة (api.js برقم إصداره، مكتبة Supabase، الأيقونات) تنحفظ في الجوال وما تنزل كل مرة.
   الصفحة نفسها وطلبات البيانات تروح للنت دائماً */
const CACHE = 'te-static-1';
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
function isStatic(u) {
  if (u.origin === self.location.origin) return (/\/(api|i18n)\.js$/.test(u.pathname) && /^\?v=\d+$/.test(u.search)) || /\/icon-\d+\.png$/.test(u.pathname);
  return u.hostname === 'cdn.jsdelivr.net' && u.pathname.indexOf('/npm/@supabase/supabase-js@2/') === 0;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let u; try { u = new URL(req.url); } catch (err) { return; }
  if (!isStatic(u)) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
      await c.put(req, res.clone());
      if (/\/(api|i18n)\.js$/.test(u.pathname)) for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) await c.delete(k); }
    }
    return res;
  })());
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'تقييم الفريق', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', dir: 'auto',
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
