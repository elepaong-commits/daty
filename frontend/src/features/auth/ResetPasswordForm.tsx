import { useState, type FormEvent } from 'react'
import { Field, inputClass } from '../../components/Field'
import { errorMessage } from '../../lib/api'
import { useResetPassword } from '../../lib/queries'
import { useT } from '../../lib/i18n'

/** Forgot password: redeem the code the partner made in their account sheet. Success logs in. */
export function ResetPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const t = useT()
  const reset = useResetPassword()
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const canSubmit = email.trim() !== '' && code.trim().length === 8 && newPassword.length >= 8

  function submit(e: FormEvent) {
    e.preventDefault()
    if (canSubmit && !reset.isPending) reset.mutate({ email, code: code.trim(), newPassword })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[20px] leading-normal">{t.auth.resetTitle}</h2>
        <p className="text-[12px] leading-normal text-muted">{t.auth.resetHelp}</p>
      </div>
      <Field label={t.auth.email}>
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
        />
      </Field>
      <Field label={t.auth.resetCode}>
        <input
          required
          maxLength={8}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className={`${inputClass} font-semibold tracking-[4px]`}
        />
      </Field>
      <Field label={t.auth.newPassword}>
        <input
          required
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </Field>

      {reset.error && <p className="text-[12px] text-coral-strong">{errorMessage(reset.error, t)}</p>}

      <button
        type="submit"
        disabled={!canSubmit || reset.isPending}
        className="mt-1 h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none"
      >
        {reset.isPending ? t.common.wait : t.auth.resetSubmit}
      </button>
      <button type="button" onClick={onBack} className="text-[13px] font-semibold text-brand">
        {t.auth.backToLogin}
      </button>
    </form>
  )
}
