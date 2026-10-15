import { useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react'
import type { CSSProperties } from 'react'
import { useIsRetro } from './theme'

/** Sheets and dialogs coming in: a soft spring that settles without bouncing past. */
export const enterSpring: Transition = { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }

/** Going away is quicker than coming in, so closing never feels like waiting. */
export const exitTween: Transition = { duration: 0.18, ease: [0.4, 0, 1, 1] }

/** Something shrinking back into its place: fast at first, easing into the spot. */
export const settleTween: Transition = { duration: 0.26, ease: [0.2, 0, 0, 1] }

/** Easing that jumps between `frames` still positions instead of gliding, like a handheld console's animation. */
export const stepped = (frames: number) => (progress: number) => (progress >= 1 ? 1 : Math.floor(progress * frames) / frames)

/**
 * How things move in each design. The classic one glides on springs; the pixel one moves in a few
 * whole frames: screens wipe in from the top, dialogs unfold like a game's text box.
 */
interface Phases {
  initial: TargetAndTransition
  animate: TargetAndTransition
  exit: TargetAndTransition
}

export interface MotionPreset {
  enter: Transition
  exit: Transition
  settle: Transition
  /** The highlight sliding between tabs. */
  highlight: Transition
  backdrop: Phases
  screen: Omit<Phases, 'exit'>
  /** Bottom sheet on phones. */
  sheet: Phases
  /** Centred dialog: the desktop sheet and confirm popups. */
  dialog: Phases
  /** Corner rounding of a photo tile, for the viewer's zoom out of it. */
  tileRadius: number
}

const classic: MotionPreset = {
  enter: enterSpring,
  exit: exitTween,
  settle: settleTween,
  highlight: enterSpring,
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: exitTween },
  },
  // A quick fade with a slight rise, no exit so switching never waits.
  screen: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } },
  },
  sheet: {
    initial: { y: '100%' },
    animate: { y: 0, transition: enterSpring },
    exit: { y: '100%', transition: { ...exitTween, duration: 0.24 } },
  },
  dialog: {
    initial: { opacity: 0, scale: 0.96, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0, transition: enterSpring },
    exit: { opacity: 0, scale: 0.97, y: 8, transition: exitTween },
  },
  tileRadius: 12,
}

const retroEnter: Transition = { duration: 0.28, ease: stepped(4) }
const retroExit: Transition = { duration: 0.16, ease: stepped(2) }

const retro: MotionPreset = {
  enter: retroEnter,
  exit: retroExit,
  settle: { duration: 0.24, ease: stepped(4) },
  highlight: { duration: 0.18, ease: stepped(3) },
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.16, ease: stepped(2) } },
    exit: { opacity: 0, transition: retroExit },
  },
  // Wipes down from the top in six frames. The clip comes off afterwards: it would also cut off
  // anything the screen shows fixed over the rest of the page (desktop dialogs).
  screen: {
    initial: { clipPath: 'inset(0 0 100% 0)' },
    animate: { clipPath: 'inset(0 0 0% 0)', transition: { duration: 0.24, ease: stepped(6) }, transitionEnd: { clipPath: 'none' } },
  },
  sheet: {
    initial: { y: '100%' },
    animate: { y: 0, transition: { duration: 0.3, ease: stepped(5) } },
    exit: { y: '100%', transition: { duration: 0.2, ease: stepped(3) } },
  },
  dialog: {
    initial: { scaleY: 0.08, scaleX: 0.7 },
    animate: { scaleY: 1, scaleX: 1, transition: retroEnter },
    exit: { scaleY: 0.08, scaleX: 0.7, opacity: 0, transition: retroExit },
  },
  tileRadius: 0,
}

/** Reduced motion keeps fades only (Motion drops transforms itself; the wipe has to go by hand). */
const retroReduced: MotionPreset = {
  ...retro,
  screen: { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.16, ease: stepped(2) } } },
}

export function useMotionPreset(): MotionPreset {
  const isRetro = useIsRetro()
  const reduce = useReducedMotion()
  if (!isRetro) return classic
  return reduce ? retroReduced : retro
}

/**
 * Class for list and grid items that rise in one after another when they first appear (plain CSS, see
 * `rise-in`); in three hops in the pixel design.
 */
export const RISE_IN = 'motion-safe:animate-rise-in motion-safe:retro:animate-pixel-rise'

/** The item's turn in that sequence; past the first few everything comes in together so long lists don't drag. */
export function riseDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, 8) * 40}ms` }
}
