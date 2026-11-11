// Service worker: keeps the app shell (page, scripts, styles, icons) on the device so the app opens
// on a slow or missing connection, and shows push notifications. API calls and photos are never cached here.

const CACHE = 'daty-shell-v1'
const SHELL = '/'
const MAX_ENTRIES = 120

self.addEventListener('install', (event) => {
  // Best effort: a failed precache only means the shell is cached on the first online visit instead.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SHELL)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

async function store(request, response) {
  if (!response.ok) return
  const cache = await caches.open(CACHE)
  await cache.put(request, response)
  // Each deploy leaves its hashed files behind; drop the oldest once there are too many.
  const keys = await cache.keys()
  if (keys.length > MAX_ENTRIES) {
    await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).filter((key) => new URL(key.url).pathname !== SHELL).map((key) => cache.delete(key)))
  }
}

// Pages: the network first so a new deploy shows up right away, the cached shell when offline.
async function page(request) {
  try {
    const response = await fetch(request)
    store(SHELL, response.clone())
    return response
  } catch {
    return (await caches.match(SHELL)) ?? Response.error()
  }
}

// Built files carry a content hash in their name, so a cached copy is always the right one.
async function hashedAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  store(request, response.clone())
  return response
}

// Icons and the manifest keep their names across deploys: answer from the cache and refresh it behind.
async function staticFile(request) {
  const cached = await caches.match(request)
  const fresh = fetch(request).then((response) => {
    store(request, response.clone())
    return response
  })
  if (!cached) return fresh
  fresh.catch(() => undefined)
  return cached
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') event.respondWith(page(request))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(hashedAsset(request))
  else if (/\.(png|svg|webmanifest|woff2?)$/.test(url.pathname)) event.respondWith(staticFile(request))
})

self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data?.json() ?? {}
  } catch {
    // Not ours; show a plain notification rather than nothing (browsers require one per push).
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'daty', {
      body: message.body || '',
      tag: message.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: message.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows[0]
      if (!open) return self.clients.openWindow(url)
      await open.focus()
      return open.navigate(url).catch(() => undefined)
    }),
  )
})
