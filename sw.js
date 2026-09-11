// LimitBreaker Service Worker
// 注意: ここに長時間の setTimeout を置いて「指定秒数後に必ず通知する」ことはできない。
//       Service Worker は OS / ブラウザに任意のタイミングで停止されるため保証にならない。
//       休憩終了の判定と通知発火はページ側（終了予定時刻方式）が担当し、
//       この SW は showNotification の受け皿と notificationclick の処理のみを担う。
const CACHE_VERSION = 'lb-v19';
const CACHE_NAME = CACHE_VERSION;
const APP_URL = '/limitbreaker/';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([APP_URL]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// 通知タップ：既に開いていればそのウィンドウを前面へ、無ければ /limitbreaker/ を開く
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || APP_URL;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url && c.url.indexOf('/limitbreaker') !== -1 && 'focus' in c) {
          return c.focus();
        }
      }
      if (list.length && 'focus' in list[0]) return list[0].focus();
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }).catch(() => {
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

// ページ側からの依頼で通知を消す（アプリ復帰時に残った通知を片付ける）
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'CLEAR_NOTIFY') {
    event.waitUntil(
      self.registration.getNotifications(data.tag ? { tag: data.tag } : {})
        .then(list => list.forEach(n => { try { n.close(); } catch (e) {} }))
        .catch(() => {})
    );
  }
});
