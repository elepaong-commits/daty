import { useState, type ComponentProps, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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

/** Password field with a button that shows or hides what was typed. */
export function PasswordInput({ className = '', ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const t = useT()
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  return (
    <span className="relative flex">
      <input {...props} type={visible ? 'text' : 'password'} className={`${inputClass} pr-11 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.common.hidePassword : t.common.showPassword}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted"
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </button>
    </span>
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
