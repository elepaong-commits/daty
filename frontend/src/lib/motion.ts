import type { Transition } from 'motion/react'

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

