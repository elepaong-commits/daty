import { useSyncExternalStore } from 'react'

// What the service worker (public/sw.js) keeps for reading offline: the API's last answers and thumbnails.
const OFFLINE_CACHES = ['daty-api-v1', 'daty-thumbs-v1']

/** Forgets what the last account saw, so the next one on this device never gets it offline. */
export function clearOfflineData() {
  if (!('caches' in window)) return
  for (const name of OFFLINE_CACHES) caches.delete(name).catch(() => {})
}

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Whether the device thinks it has a connection. */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine)
