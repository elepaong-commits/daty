// Service worker: keeps the app shell (page, scripts, styles, icons) on the device so the app opens
// on a slow or missing connection, keeps the last answers from the API and the thumbnails so what was
// seen can be read offline, and shows push notifications. Full-size photos and videos are not kept.

const CACHE = 'daty-shell-v1'
// Also named in src/lib/offline.ts, which empties them on logout.
const API_CACHE = 'daty-api-v1'
const THUMB_CACHE = 'daty-thumbs-v1'
const MAX_THUMBS = 400
// Not kept: a file export and download links are one-off and private.
const API_SKIP = [/^\/api\/couple\/export/, /\/photos\/downloads$/]
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
      .then((names) =>
        Promise.all(names.filter((name) => ![CACHE, API_CACHE, THUMB_CACHE].includes(name)).map((name) => caches.delete(name))),
      )
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

// The API: always asked first; its last answer is kept and given back when there is no connection,
// marked with `x-daty-offline` so the page can say it is showing what it saw before.
async function api(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      // Cloned now: once the page has read the body, it can't be.
      const copy = response.clone()
      caches.open(API_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
    }
    return response
  } catch (error) {
    const cached = await caches.match(request, { cacheName: API_CACHE })
    if (!cached) throw error
    const headers = new Headers(cached.headers)
    headers.set('x-daty-offline', '1')
    return new Response(cached.body, { status: cached.status, headers })
  }
}

// Thumbnails and profile photos from storage: their signed links change every few days, so they are
// kept by path. Read with CORS (not as opaque responses, which browsers count as megabytes each);
// if storage doesn't allow that, they are simply not kept.
async function thumbnail(request) {
  const url = new URL(request.url)
  const key = url.origin + url.pathname
  const cache = await caches.open(THUMB_CACHE)
  const cached = await cache.match(key)
  if (cached) return cached
  try {
    const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      await cache.put(key, response.clone())
      const keys = await cache.keys()
      if (keys.length > MAX_THUMBS) await Promise.all(keys.slice(0, keys.length - MAX_THUMBS).map((k) => cache.delete(k)))
    }
    return response
  } catch {
    return fetch(request)
  }
}

const isThumbnail = (url) => /\.thumb\.jpg$/.test(url.pathname) || /^\/[^/]+\/avatars\//.test(url.pathname) || url.pathname.startsWith('/avatars/')

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) {
    if (isThumbnail(url)) event.respondWith(thumbnail(request))
    return
  }
  if (url.pathname.startsWith('/api/')) {
    if (!API_SKIP.some((re) => re.test(url.pathname))) event.respondWith(api(request))
    return
  }
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
