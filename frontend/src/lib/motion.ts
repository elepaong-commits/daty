import type { Transition } from 'motion/react'
import type { CSSProperties } from 'react'

/** Sheets and dialogs coming in: a soft spring that settles without bouncing past. */
export const enterSpring: Transition = { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }

/** Going away is quicker than coming in, so closing never feels like waiting. */
export const exitTween: Transition = { duration: 0.18, ease: [0.4, 0, 1, 1] }

/** The dimmed backdrop behind sheets and dialogs. */
export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: exitTween },
}

/** Something shrinking back into its place: fast at first, easing into the spot. */
export const settleTween: Transition = { duration: 0.26, ease: [0.2, 0, 0, 1] }

/** A screen (tab or detail) appearing: a quick fade with a slight rise, no exit so switching never waits. */
export const screenEnter = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } },
} as const

/** Class for list and grid items that rise in one after another when they first appear (plain CSS, see `rise-in`). */
export const RISE_IN = 'motion-safe:animate-rise-in'

/** The item's turn in that sequence; past the first few everything comes in together so long lists don't drag. */
export function riseDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, 8) * 40}ms` }
}
