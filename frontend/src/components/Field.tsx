import type { ReactNode } from 'react'
import { errorMessage } from '../lib/api'
import { useT } from '../lib/i18n'

export const inputClass =
  'h-11 w-full rounded-xl border border-field-border bg-field px-3 text-[14px] text-ink placeholder:text-placeholder outline-none focus:border-brand'

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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex h-8 shrink-0 items-center gap-1.5 px-3 font-pixel text-[11px] leading-normal whitespace-nowrap pixel-outline pixel-thin pixel-crisp ${
        selected ? 'bg-ink text-white' : 'bg-white text-ink [--pixel-border:var(--color-handle)]'
      }`}
    >
      {children}
    </button>
  )
}

export function QueryState({ isLoading, error }: { isLoading: boolean; error: Error | null }) {
  const t = useT()
  if (isLoading) return <p className="py-10 text-center text-[13px] text-muted">{t.common.loading}</p>
  if (error) return <p className="py-10 text-center text-[13px] text-coral-strong">{t.common.loadFailed}: {errorMessage(error, t)}</p>
  return null
}
