import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useT } from '../lib/i18n'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Modal sheet that slides up over the current screen (design: "Schedule modal overlay"); a centered dialog on desktop. */
export function BottomSheet({ title, onClose, children }: Props) {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end lg:fixed lg:items-center lg:justify-center lg:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/42" onClick={onClose} />
      <div className="relative flex max-h-[92%] flex-col rounded-t-[28px] bg-white px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] lg:max-h-full lg:w-[560px] lg:rounded-[28px] lg:px-7 lg:pt-6 lg:pb-7 lg:shadow-card">
        <div className="flex justify-center pb-2 lg:hidden">
          <div className="h-1.5 w-10 rounded-full bg-handle" />
        </div>
        <div className="flex items-center justify-between pb-4">
          <h2 className="font-display text-[20px] leading-normal lg:text-[24px]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-sand-soft"
            aria-label={t.common.close}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="scrollbar-none -mx-5 overflow-y-auto px-5 lg:-mx-7 lg:px-7">{children}</div>
      </div>
    </div>
  )
}
