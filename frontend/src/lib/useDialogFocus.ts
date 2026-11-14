import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'video[controls]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Open modals, innermost last: a confirm over a sheet takes Tab and Escape, the sheet doesn't.
const stack: HTMLElement[] = []

/** Whether `el` is the innermost open modal, for its own extra keys (a viewer's arrows). */
export const isTopModal = (el: HTMLElement | null) => el !== null && stack.at(-1) === el

/**
 * Keyboard and focus for a modal (sheet, dialog, viewer): focus moves into it on open, Tab and
 * Shift+Tab cycle inside it, Escape calls `onEscape`, and focus goes back to whatever opened it on close.
 * Put the returned ref on the modal's root and give that root `tabIndex={-1}`; a root that already
 * has a ref (an animation scope) passes it in as `rootRef`.
 */
export function useDialogFocus<T extends HTMLElement>(onEscape: () => void, rootRef?: { readonly current: T | null }) {
  const ownRef = useRef<T>(null)
  const ref = rootRef ?? ownRef
  const escape = useRef(onEscape)
  useEffect(() => {
    escape.current = onEscape
  })

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    stack.push(root)
    // The modal itself, not its first field: that would pop up the keyboard on phones.
    if (!root.contains(document.activeElement)) root.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (stack.at(-1) !== root) return
      if (e.key === 'Escape') {
        e.preventDefault()
        escape.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
      const first = items[0]
      const last = items.at(-1)
      const active = document.activeElement
      if (!first || !last) {
        e.preventDefault()
      } else if (!root.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(root), 1)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- the root is there from the first render

  return ownRef
}
