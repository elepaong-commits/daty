import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

// Drag, layout and exit animation code arrives in its own chunk once the app has rendered.
const loadFeatures = () => import('../lib/motionFeatures').then((m) => m.default)

/**
 * Motion for the whole app. `strict` keeps components on the slim `m.*` elements; "user" drops
 * movement (but keeps fades) when the OS asks for reduced motion.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
