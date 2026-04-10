// LimitBreaker Service Worker
const CACHE_VERSION = 'lb-v7';
const CACHE_ASSETS = [
  '/limitbreaker/',
  '/limitbreaker/index.html',
  '/limitbreaker/manifest.json',
  '/limitbreaker/icon-192.png',
  '/limitbreaker/icon-512.png',
];

// ─── インストール & キャッシュ ───
self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c=>c.addAll(CACHE_ASSETS)).then(()=>self.skipWaiting())
  );
});

// ─── アクティベート & 古いキャッシュ削除 ───
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k)))
    ).then(()=>self.clients.claim())
  );
});

// ─── フェッチ（キャッシュファースト） ───
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(
    caches.match(e.request).then(cached=>cached||fetch(e.request))
  );
});

// ─── タイマー通知スケジューラ ───
let _timerTimeout = null;

self.addEventListener('message', e=>{
  const data = e.data;
  if(!data || !data.type) return;

  if(data.type === 'TIMER_START'){
    // 既存スケジュールをクリア
    if(_timerTimeout){ clearTimeout(_timerTimeout); _timerTimeout = null; }

    const delay = Math.max(0, data.endAt - Date.now());
    _timerTimeout = setTimeout(async ()=>{
      _timerTimeout = null;

      // フォアグラウンドのクライアントに音声再生を依頼
      const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
      const fgClients = clients.filter(c=>c.visibilityState==='visible');
      fgClients.forEach(c=>c.postMessage({type:'TIMER_FIRED'}));

      // バックグラウンド・フォアグラウンド両方に通知
      // （フォアグラウンド時もtag:'rest-end'で重複を防ぐ）
      try{
        await self.registration.showNotification('LimitBreaker 💪',{
          body: 'レスト終了！次のセットを開始してください',
          icon: '/limitbreaker/icon-192.png',
          badge: '/limitbreaker/icon-192.png',
          tag: 'rest-end',           // 同一タグは上書きされ重複しない
          requireInteraction: false,
          vibrate: [200, 100, 200, 100, 400],
        });
      }catch(err){
        // showNotification が使えない環境は無視
        console.warn('[SW] showNotification failed:', err);
      }
    }, delay);
  }

  if(data.type === 'TIMER_CANCEL'){
    if(_timerTimeout){ clearTimeout(_timerTimeout); _timerTimeout = null; }
  }
});

// ─── 通知タップ時にアプリを前面に出す ───
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(clients=>{
      if(clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('/limitbreaker/');
    })
  );
});
