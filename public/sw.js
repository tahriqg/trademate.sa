// TradeMate SA service worker.
// Keeps the app's own files (the "app shell") so it opens quickly and shows a friendly
// message offline. It NEVER stores customer or quotation data: requests to Supabase
// (a different website) are left completely alone.
const VERSION = 'trademate-v1'
const SHELL = ['/', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // never touch Supabase or other sites
  if (url.pathname === '/sw.js') return

  // Opening a page: try the internet first so people always get the newest version.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(VERSION).then((cache) => cache.put('/', copy))
          }
          return res
        })
        .catch(async () => (await caches.match('/')) || caches.match('/offline.html')),
    )
    return
  }

  // App files (scripts, styles, icons): use the saved copy and refresh it in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(VERSION).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
