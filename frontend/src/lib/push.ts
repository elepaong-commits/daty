import { api } from './api'
import type { Lang } from './i18n'

// Web push on this device: the service worker (public/sw.js) receives the notifications, the backend
// keeps the subscription with the device's language and time zone.

export const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Starts the service worker (app shell cache and notifications). Safe to call on every load. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app works without it; only offline opening and notifications are lost.
    })
  })
}

/** Thrown when the person (or the browser) has notifications blocked. */
export class PushDeniedError extends Error {}

const decodeKey = (base64url: string) =>
  Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function register(subscription: PushSubscription, lang: Lang) {
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Incomplete push subscription')
  await api.savePushSubscription({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, locale: lang })
}

/** This device's subscription, if notifications are on. */
export async function currentSubscription() {
  if (!pushSupported) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function enablePush(lang: Lang) {
  if ((await Notification.requestPermission()) !== 'granted') throw new PushDeniedError()
  const { publicKey } = await api.pushKey()
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) }))
  await register(subscription, lang)
}

export async function disablePush() {
  const subscription = await currentSubscription()
  if (!subscription) return
  await api.deletePushSubscription(subscription.endpoint).catch(() => undefined)
  await subscription.unsubscribe()
}

/** Keeps the saved language, time zone and account current for a device that already has notifications on. */
export async function refreshPush(lang: Lang) {
  const subscription = await currentSubscription().catch(() => null)
  if (subscription && Notification.permission === 'granted') await register(subscription, lang).catch(() => undefined)
}
