import { X } from 'lucide-react'
import { m, useDragControls, useIsPresent, type PanInfo } from 'motion/react'
import { type PointerEvent, type ReactNode } from 'react'
import { useT } from '../lib/i18n'
import { useMotionPreset } from '../lib/motion'
import { useIsRetro } from '../lib/theme'
import { PixelSprite } from './PixelSprite'
import { useIsDesktop } from '../lib/useIsDesktop'
import { useDialogFocus } from '../lib/useDialogFocus'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

// Pulled down this far, or flicked down this fast, the sheet closes instead of springing back.
const CLOSE_DISTANCE = 120
const CLOSE_VELOCITY = 600

/**
 * Modal sheet that slides up over the current screen (design: "Schedule modal overlay"); a centered dialog on desktop.
 * On phones it can be dragged down by its handle and title to close. Render it inside `AnimatePresence`
 * so it also animates out.
 */
export function BottomSheet({ title, onClose, children }: Props) {
  const t = useT()
  const isDesktop = useIsDesktop()
  const isPresent = useIsPresent()
  const dragControls = useDragControls()
  const motion = useMotionPreset()
  const retro = useIsRetro()

  const focusRef = useDialogFocus<HTMLDivElement>(onClose)

  // Drags start only from the top bar, so the form below still scrolls and its fields take taps.
  const startDrag = (e: PointerEvent) => {
    if (!isDesktop && !(e.target as Element).closest('button')) dragControls.start(e)
  }
  const endDrag = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) onClose()
  }

  const panel = isDesktop ? motion.dialog : motion.sheet

  return (
    <div
      ref={focusRef}
      tabIndex={-1}
      className={`absolute inset-0 z-50 flex flex-col justify-end outline-none lg:fixed lg:items-center lg:justify-center lg:p-8 ${
        isPresent ? '' : 'pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <m.div className="ui-backdrop absolute inset-0" onClick={onClose} {...motion.backdrop} />
      <m.div
        {...panel}
        drag={isDesktop ? false : 'y'}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        onDragEnd={endDrag}
        className="relative flex max-h-[92%] flex-col rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] retro:border-t-3 retro:border-ink lg:max-h-full lg:w-[560px] lg:rounded-[28px] lg:px-7 lg:pt-6 lg:pb-7 lg:shadow-card lg:retro:border-t-0 lg:retro:pixel-box"
      >
        <div onPointerDown={startDrag} className="touch-none lg:touch-auto">
          <div className="flex justify-center pb-2 lg:hidden">
            <div className="h-1.5 w-10 rounded-full bg-handle" />
          </div>
          <div className="flex items-center justify-between pb-4">
            <h2 className="font-display text-[20px] leading-normal lg:text-[24px] retro:text-[15px] retro:pixel-crisp lg:retro:text-[15px]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="ui-btn-thin flex size-8 items-center justify-center rounded-full bg-sand-soft retro:size-7 retro:bg-surface"
              aria-label={t.common.close}
            >
              {retro ? <PixelSprite name="close" scale={2} /> : <X size={16} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
        {/* A little room at the top so pixel outlines of the first fields aren't cut off. */}
        <div className="scrollbar-none -mx-5 overflow-y-auto px-5 retro:pt-1 lg:-mx-7 lg:px-7">{children}</div>
      </m.div>
    </div>
  )
}
