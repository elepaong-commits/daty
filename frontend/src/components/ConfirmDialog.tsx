import { m, useIsPresent } from 'motion/react'
import { useEffect } from 'react'
import { useMotionPreset } from '../lib/motion'

interface Props {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel: string
  error?: string | null
  /** Disables the confirm button while its action runs. */
  busy?: boolean
  /** Red confirm button, for deleting. */
  danger?: boolean
  /** Over the whole page (rendered in a portal) instead of the screen it sits in. */
  fixed?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Small centered yes/no popup over the current screen. Render it inside `AnimatePresence` so it also animates out. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, error, busy, danger, fixed, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  const isPresent = useIsPresent()
  const motion = useMotionPreset()

  return (
    <div
      className={`${fixed ? 'fixed' : 'absolute lg:fixed'} inset-0 z-[60] flex items-center justify-center px-8 ${isPresent ? '' : 'pointer-events-none'}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <m.div className="ui-backdrop absolute inset-0" onClick={onCancel} {...motion.backdrop} />
      <m.div
        {...motion.dialog}
        className="ui-box relative flex w-full max-w-[320px] flex-col gap-2 rounded-3xl bg-white p-5 text-center shadow-card">
        <h2 className="font-display text-[20px] leading-normal retro:text-[15px] retro:pixel-crisp">{title}</h2>
        {message && <p className="ui-prose text-[14px] leading-[1.6] text-ink/75">{message}</p>}
        {error && <p className="text-[12px] text-coral-strong">{error}</p>}
        <div className="flex gap-2 pt-3">
          <button type="button" onClick={onCancel} className="ui-btn-thin h-11 flex-1 rounded-2xl bg-sand-soft text-[15px] font-semibold text-muted retro:bg-white retro:text-[13px] retro:text-ink">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`ui-btn-thin h-11 flex-1 rounded-2xl text-[15px] font-semibold text-white disabled:opacity-50 retro:text-[13px] ${danger ? 'bg-danger' : 'bg-brand-strong'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </m.div>
    </div>
  )
}
