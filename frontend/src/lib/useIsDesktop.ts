import { useSyncExternalStore } from 'react'

// Tailwind's `lg` breakpoint: from here the app uses the sidebar layout instead of the phone column.
const QUERY = '(min-width: 1024px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** True on desktop-width screens, for layouts that differ in structure rather than just in `lg:` classes. */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
