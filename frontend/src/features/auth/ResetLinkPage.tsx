import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Field, PasswordInput } from '../../components/Field'
import { ApiError, errorMessage } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { useResetPassword } from '../../lib/queries'

/** Where the link in a password reset email lands: pick a new password and you're logged in. */
export function ResetLinkPage() {
  const t = useT()
  const navigate = useNavigate()
  const token = useSearchParams()[0].get('token') ?? ''
  const reset = useResetPassword()
  const [newPassword, setNewPassword] = useState('')
  const canSubmit = token !== '' && newPassword.length >= 8
  const invalid = token === '' || (reset.error instanceof ApiError && reset.error.code === 'INVALID_RESET_CODE')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || reset.isPending) return
    reset.mutate({ token, newPassword }, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-10">
      <div className="pb-8 text-center">
        <p className="text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand-text">{t.auth.tagline}</p>
        <h1 className="font-display text-[44px] leading-[1.25]">daty</h1>
      </div>
      <form onSubmit={submit} className="ui-box flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card retro:mx-0.5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[20px] leading-normal">{t.auth.linkTitle}</h2>
          <p className="text-[12px] leading-normal text-muted">{t.auth.linkHelp}</p>
        </div>
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
        {invalid ? (
          <p className="text-[12px] text-coral-strong">{t.auth.linkInvalid}</p>
        ) : (
          reset.error && <p className="text-[12px] text-coral-strong">{errorMessage(reset.error, t)}</p>
        )}
        <button
          type="submit"
          disabled={!canSubmit || reset.isPending}
          className="ui-btn mt-1 h-12 w-full rounded-2xl bg-brand-strong text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none retro:mb-1.5 retro:text-[14px]"
        >
          {reset.isPending ? t.common.wait : t.auth.linkSubmit}
        </button>
        <button type="button" onClick={() => navigate('/', { replace: true })} className="text-[13px] font-semibold text-brand-text">
          {t.auth.backToLogin}
        </button>
      </form>
    </div>
  )
}
