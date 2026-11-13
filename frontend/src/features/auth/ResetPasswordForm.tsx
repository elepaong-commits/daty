import { useState, type FormEvent } from 'react'
import { Field, inputClass, PasswordInput } from '../../components/Field'
import { errorMessage } from '../../lib/api'
import { useForgotPassword, useResetPassword } from '../../lib/queries'
import { useI18n } from '../../lib/i18n'

type Method = 'code' | 'email'

/**
 * Forgot password, two ways: redeem the code the partner made in their account sheet (success logs in),
 * or have a reset link sent by email.
 */
export function ResetPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const { lang, t } = useI18n()
  const reset = useResetPassword()
  const forgot = useForgotPassword()
  const [method, setMethod] = useState<Method>('code')
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const canSubmit = email.trim() !== '' && code.trim().length === 8 && newPassword.length >= 8

  function submit(e: FormEvent) {
    e.preventDefault()
    if (method === 'email') {
      if (email.trim() !== '' && !forgot.isPending) forgot.mutate({ email, lang })
    } else if (canSubmit && !reset.isPending) {
      reset.mutate({ email, code: code.trim(), newPassword })
    }
  }

  const tabs = (
    <div className="flex h-10 gap-1 rounded-2xl bg-segment p-1" role="tablist">
      {(['code', 'email'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={method === value}
          onClick={() => setMethod(value)}
          className={`flex-1 rounded-xl text-[12px] font-semibold ${method === value ? 'bg-white text-brand-strong' : 'text-ink'}`}
        >
          {value === 'code' ? t.auth.resetByCode : t.auth.resetByEmail}
        </button>
      ))}
    </div>
  )

  if (method === 'email') {
    return (
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-card">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[20px] leading-normal">{t.auth.resetTitle}</h2>
          <p className="text-[12px] leading-normal text-muted">{t.auth.resetEmailHelp}</p>
        </div>
        {tabs}
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
        {forgot.error && <p className="text-[12px] text-coral-strong">{errorMessage(forgot.error, t)}</p>}
        {forgot.isSuccess && <p className="text-[12px] leading-normal text-brand-strong">{t.auth.resetMailSent}</p>}
        <button
          type="submit"
          disabled={email.trim() === '' || forgot.isPending}
          className="ui-btn mt-1 h-12 w-full rounded-2xl bg-brand-strong text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none retro:mb-1.5 retro:text-[14px]"
        >
          {forgot.isPending ? t.common.wait : t.auth.sendResetMail}
        </button>
        <button type="button" onClick={onBack} className="text-[13px] font-semibold text-brand-strong">
          {t.auth.backToLogin}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[20px] leading-normal">{t.auth.resetTitle}</h2>
        <p className="text-[12px] leading-normal text-muted">{t.auth.resetHelp}</p>
      </div>
      {tabs}
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
        <PasswordInput
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </Field>

      {reset.error && <p className="text-[12px] text-coral-strong">{errorMessage(reset.error, t)}</p>}

      <button
        type="submit"
        disabled={!canSubmit || reset.isPending}
        className="ui-btn mt-1 h-12 w-full rounded-2xl bg-brand-strong text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none retro:mb-1.5 retro:text-[14px]"
      >
        {reset.isPending ? t.common.wait : t.auth.resetSubmit}
      </button>
      <button type="button" onClick={onBack} className="text-[13px] font-semibold text-brand-strong">
        {t.auth.backToLogin}
      </button>
    </form>
  )
}
