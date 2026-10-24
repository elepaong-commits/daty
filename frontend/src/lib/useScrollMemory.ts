import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// Scroll offsets by history entry. Going back returns to the same entry (same key) and its offset;
// opening the screen anew (a tab tap) is a new entry and starts at the top.
const offsets = new Map<string, number>()

/**
 * Keeps a scrolling list where it was when the user opens an item and comes back. Screens unmount
 * on navigation and scroll inside their own column, so the browser can't restore it by itself.
 * `ready` is when the content is laid out at full height (e.g. the query has data).
 */
export function useScrollMemory<T extends HTMLElement>(ready: boolean) {
  const ref = useRef<T>(null)
  const { key } = useLocation()
  const restored = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ready || restored.current) return
    restored.current = true
    const top = offsets.get(key)
    if (top) el.scrollTop = top
  }, [key, ready])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const save = () => offsets.set(key, el.scrollTop)
    el.addEventListener('scroll', save, { passive: true })
    return () => el.removeEventListener('scroll', save)
  }, [key])

  return ref
}
