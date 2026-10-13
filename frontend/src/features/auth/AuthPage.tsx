import { useState, type FormEvent } from 'react'
import { Field, inputClass } from '../../components/Field'
import { LanguageToggle } from '../../components/ScreenHeader'
import { errorMessage } from '../../lib/api'
import { useLogin, useSignup } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import { ResetPasswordForm } from './ResetPasswordForm'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const t = useT()
  const login = useLogin()
  const signup = useSignup()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [resetting, setResetting] = useState(false)

  const active = mode === 'login' ? login : signup
  const canSubmit =
    email.trim() !== '' && password.length >= (mode === 'signup' ? 8 : 1) && (mode === 'login' || nickname.trim() !== '')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || active.isPending) return
    if (mode === 'login') login.mutate({ email, password })
    else signup.mutate({ email, password, nickname: nickname.trim() })
  }

  function switchMode(next: Mode) {
    setMode(next)
    login.reset()
    signup.reset()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-10">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div className="pb-8 text-center">
        <p className="text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand">{t.auth.tagline}</p>
        <h1 className="font-display text-[44px] leading-[1.25]">daty</h1>
      </div>

      {resetting ? (
        <ResetPasswordForm initialEmail={email} onBack={() => setResetting(false)} />
      ) : (
        <>
          <div className="mb-5 flex h-11 gap-2 rounded-2xl bg-segment p-1" role="tablist">
            {(['login', 'signup'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`flex-1 rounded-xl text-[14px] font-semibold ${mode === value ? 'bg-white text-brand' : 'text-ink'}`}
              >
                {value === 'login' ? t.auth.login : t.auth.signup}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-card">
            {mode === 'signup' && (
              <Field label={t.auth.nickname}>
                <input
                  required
                  maxLength={20}
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t.auth.nicknamePlaceholder}
                  className={inputClass}
                />
              </Field>
            )}
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
            <Field label={mode === 'signup' ? t.auth.newPassword : t.auth.password}>
              <input
                required
                type="password"
                minLength={mode === 'signup' ? 8 : undefined}
                maxLength={72}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>

            {active.error && <p className="text-[12px] text-coral-strong">{errorMessage(active.error, t)}</p>}

            <button
              type="submit"
              disabled={!canSubmit || active.isPending}
              className="mt-1 h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none"
            >
              {active.isPending ? t.common.wait : mode === 'login' ? t.auth.login : t.auth.signupSubmit}
            </button>
            {mode === 'login' && (
              <button type="button" onClick={() => setResetting(true)} className="text-[13px] font-semibold text-muted">
                {t.auth.forgot}
              </button>
            )}
          </form>
        </>
      )}
    </div>
  )
}
