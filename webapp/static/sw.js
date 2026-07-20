const CACHE_NAME = 'wiamapp-v3';
const OFFLINE_URL = '/static/offline.html';
const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/manifest.json',
  OFFLINE_URL,
];

/** Render cold wakes often return a single 502/503 — retry before showing offline UI. */
async function fetchNavigateWithBackoff(request, maxAttempts = 4) {
  let lastResp = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (attempt > 1) {
        await new Promise((r) => setTimeout(r, 450 + (attempt - 1) * 550));
      }
      const resp = await fetch(request);
      lastResp = resp;
      const st = resp.status;
      if (st !== 502 && st !== 503 && st !== 504) {
        return resp;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastResp) {
    return lastResp;
  }
  throw lastErr || new Error('navigate fetch failed');
}

// Install — cache shell + offline page
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first; show branded offline page for 502/503/network errors
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // For navigation requests (HTML pages), intercept server errors
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetchNavigateWithBackoff(e.request)
        .then((resp) => {
          if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
            return caches.match(OFFLINE_URL) || resp;
          }
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return resp;
        })
        .catch(() => {
          // Network failure — show branded offline page
          return caches.match(OFFLINE_URL) || caches.match(e.request);
        })
    );
    return;
  }

  // For other assets — network-first, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push notification handler
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'WiamApp';
  const type = data.type || 'system';

  // Type-specific icons (emoji as visual cue in body)
  const typeIcons = {
    new_book: '📖',
    new_chapter: '📝',
    follow: '👤',
    comment: '💬',
    like: '❤️',
    mention: '📣',
    coins: '🪙',
    order_update: '📦',
    elite: '✦',
    announcement: '📢',
    system: '🔔',
  };
  const emoji = typeIcons[type] || '🔔';

  const options = {
    body: data.body || '',
    icon: '/static/img/icon-192.png',
    badge: '/static/img/favicon-32.png',
    tag: type + '-' + Date.now(),
    renotify: true,
    vibrate: [100, 50, 100, 50, 150],
    data: { url: data.url || '/', type: type },
    actions: data.url ? [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ] : [],
  };
  e.waitUntil(
    self.registration.showNotification(emoji + ' ' + title, options).then(function() {
      // Set PWA app icon badge count
      if (self.navigator && self.navigator.setAppBadge) {
        self.navigator.setAppBadge().catch(function(){});
      }
    })
  );
});

// Notification click — open the link
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
