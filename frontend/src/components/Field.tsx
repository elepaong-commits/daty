import type { ReactNode } from 'react'
import { errorMessage } from '../lib/api'
import { useT } from '../lib/i18n'

/** Text field look, in both designs (see `ui-input` in `index.css`). */
export const inputClass = 'ui-input'

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[12px] leading-normal font-semibold text-muted">{label}</span>
      {children}
    </label>
  )
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="ui-chip">
      {children}
    </button>
  )
}

export function QueryState({ isLoading, error }: { isLoading: boolean; error: Error | null }) {
  const t = useT()
  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted">
        {/* Pixel design: three blocks lighting up in turn, like a handheld loading a save. */}
        <span className="hidden gap-1 retro:flex" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 bg-brand motion-safe:animate-pixel-blink" style={{ animationDelay: `${i * 0.3}s` }} />
          ))}
        </span>
        {t.common.loading}
      </p>
    )
  }
  if (error) return <p className="py-10 text-center text-[13px] text-coral-strong">{t.common.loadFailed}: {errorMessage(error, t)}</p>
  return null
}
