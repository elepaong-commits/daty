import { useSyncExternalStore } from 'react'

// The `md` breakpoint (see index.css): from tablets up the app uses the sidebar layout instead of the phone column.
const QUERY = '(min-width: 46rem)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** True on tablet and desktop widths, for layouts that differ in structure rather than just in `md:` classes. */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
