import { m, useIsPresent } from 'motion/react'
import { useEffect } from 'react'
import { backdropMotion, enterSpring, exitTween } from '../lib/motion'

interface Props {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  error?: string | null
  /** Disables the confirm button while its action runs. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Small centered yes/no popup over the current screen. Render it inside `AnimatePresence` so it also animates out. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, error, busy, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  const isPresent = useIsPresent()

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center px-8 lg:fixed ${isPresent ? '' : 'pointer-events-none'}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <m.div className="absolute inset-0 bg-ink/42" onClick={onCancel} {...backdropMotion} />
      <m.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1, transition: enterSpring }}
        exit={{ opacity: 0, scale: 0.96, transition: exitTween }}
        className="relative flex w-full max-w-[320px] flex-col gap-2 rounded-3xl bg-white p-5 text-center shadow-card">
        <h2 className="font-display text-[20px] leading-normal">{title}</h2>
        <p className="text-[14px] leading-[1.6] text-ink/75">{message}</p>
        {error && <p className="text-[12px] text-coral-strong">{error}</p>}
        <div className="flex gap-2 pt-3">
          <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-2xl bg-sand-soft text-[15px] font-semibold text-muted">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-11 flex-1 rounded-2xl bg-brand text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </m.div>
    </div>
  )
}
