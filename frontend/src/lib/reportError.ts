// Errors in the app go to the server (POST /api/client-errors), which logs them and mails the admin,
// so a screen that breaks on one phone doesn't go unnoticed. A few per page load, each message once.

const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const MAX_PER_PAGE = 5
// Browser noise that says nothing about the app: cross-origin scripts, a benign layout warning, aborted requests.
const IGNORED = [/^Script error\.?$/, /ResizeObserver loop/, /AbortError/]

const sent = new Set<string>()

export function reportError(error: unknown) {
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 500)
  if (!message || sent.has(message) || sent.size >= MAX_PER_PAGE || IGNORED.some((re) => re.test(message))) return
  if (import.meta.env.DEV) return
  sent.add(message)
  fetch(`${BASE_URL}/api/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Still goes out if the page is being left.
    keepalive: true,
    body: JSON.stringify({
      message,
      stack: error instanceof Error ? error.stack?.slice(0, 4000) : undefined,
      url: location.pathname,
      userAgent: navigator.userAgent.slice(0, 300),
    }),
  }).catch(() => {
    // Offline or the server is down: nothing more to do.
  })
}

/** Reports errors nothing else caught. */
export function watchErrors() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason))
}
