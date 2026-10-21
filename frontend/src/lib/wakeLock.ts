/**
 * Keeps the screen from turning itself off until the returned function is called. The browser drops the lock
 * whenever the page is hidden, so it is taken again when the page comes back. Does nothing where unsupported.
 */
export function keepScreenOn() {
  if (!('wakeLock' in navigator)) return () => {}
  let lock: WakeLockSentinel | null = null
  let released = false
  const request = () => {
    if (released || document.visibilityState !== 'visible') return
    navigator.wakeLock.request('screen').then(
      (sentinel) => (released ? void sentinel.release() : (lock = sentinel)),
      () => {}, // e.g. battery saver; uploading goes on regardless
    )
  }
  document.addEventListener('visibilitychange', request)
  request()
  return () => {
    released = true
    document.removeEventListener('visibilitychange', request)
    void lock?.release()
  }
}
