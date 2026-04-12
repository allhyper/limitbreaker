const CACHE_VERSION = 'lb-v10';
const CACHE_ASSETS = ['/limitbreaker/', '/limitbreaker/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c => c.addAll(CACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/limitbreaker/index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// バックグラウンド通知専用（タイマーは持たない）
self.addEventListener('message', e => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'CLEAR_NOTIFY') {
    self.registration.getNotifications().then(notes => {
      notes.forEach(n => n.close());
    }).catch(() => {});
  }

  if (data.type === 'NOTIFY_NOW') {
    self.registration.showNotification('LimitBreaker ⏱', {
      body: data.body || 'レスト終了！次のセットを開始してください',
      icon: '/limitbreaker/icon-192.png',
      badge: '/limitbreaker/icon-192.png',
      tag: 'rest-end-' + Date.now(),
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 500],
      silent: false
    }).catch(() => {});
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes('limitbreaker') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/limitbreaker/');
    })
  );
});
