/* Emberkeep service worker
 * - 앱 셸(HTML/아이콘/매니페스트)을 캐시해 오프라인에서도 실행
 * - index.html은 stale-while-revalidate: 캐시로 즉시 열고, 뒤에서 새 버전을 받아 다음 실행에 반영
 * - 세이브 데이터는 localStorage에 있으므로 이 파일과 무관하게 유지됨
 * 구조가 바뀌는 큰 업데이트 때만 VERSION을 올리면 옛 캐시가 정리됨 */
const VERSION = 'emberkeep-pwa-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isPage) {
    event.respondWith(pageStrategy(event));
  } else {
    event.respondWith(assetStrategy(req));
  }
});

async function pageStrategy(event) {
  const cache = await caches.open(VERSION);
  const cached = (await cache.match('./index.html')) || (await cache.match('./'));
  const update = fetch('./index.html', { cache: 'no-cache' })
    .then((res) => {
      if (res && res.ok) cache.put('./index.html', res.clone());
      return res;
    })
    .catch(() => null);
  event.waitUntil(update);
  if (cached) return cached;
  const fresh = await update;
  return fresh || new Response('오프라인 상태이고 저장된 게임 파일이 없어요. 온라인에서 한 번 열어주세요.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function assetStrategy(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}
