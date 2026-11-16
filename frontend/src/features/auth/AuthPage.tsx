import { Heart, MapPin } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Field, inputClass, PasswordInput } from '../../components/Field'
import { LanguageToggle, ThemeToggle } from '../../components/SettingToggles'
import { errorMessage } from '../../lib/api'
import { categoryOf, PHOTO_GRADIENTS } from '../../lib/categories'
import { useLogin, useSignup, useSignupOpen } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import { ResetPasswordForm } from './ResetPasswordForm'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const t = useT()
  const login = useLogin()
  const signup = useSignup()
  // Shown only once the server says it's open, so a closed signup never flashes in.
  const signupOpen = useSignupOpen().data === true
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
    <div className="flex min-h-0 flex-1 overflow-y-auto">
      <AuthHero />
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-10 md:items-center md:px-8 lg:px-12">
      <div className="w-full md:max-w-[400px]">
      {/* The design can be switched right here, and later in the account sheet. */}
      <div className="flex justify-end gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <div className="pb-8 text-center">
        <p className="text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand-text">{t.auth.tagline}</p>
        <h1 className="font-display text-[44px] leading-[1.25]">daty</h1>
      </div>

      {resetting ? (
        <ResetPasswordForm initialEmail={email} onBack={() => setResetting(false)} />
      ) : (
        <>
          {signupOpen && (
            <div className="ui-seg mb-5 flex h-11 gap-2 rounded-2xl bg-segment p-1" role="tablist">
              {(['login', 'signup'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => switchMode(value)}
                  className={`ui-seg-option flex-1 rounded-xl text-[14px] font-semibold retro:text-[13px] ${mode === value ? 'bg-surface text-brand-text' : 'text-ink'}`}
                >
                  {value === 'login' ? t.auth.login : t.auth.signup}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="ui-box flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card retro:mx-0.5">
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
              <PasswordInput
                required
                minLength={mode === 'signup' ? 8 : undefined}
                maxLength={72}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {active.error && <p className="text-[12px] text-coral-strong">{errorMessage(active.error, t)}</p>}

            <button
              type="submit"
              disabled={!canSubmit || active.isPending}
              className="ui-btn mt-1 h-12 w-full rounded-2xl bg-brand-strong text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none retro:mb-1.5 retro:text-[14px]"
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
      </div>
    </div>
  )
}

/** Desktop-only left half of the login screen: the app's name and a map-and-prints illustration. */
function AuthHero() {
  const t = useT()
  const prints = [
    { category: 'CAFE', className: 'top-[6%] right-[14%] rotate-[8deg]' },
    { category: 'TOUR', className: 'top-[44%] right-[4%] -rotate-6' },
    { category: 'EXHIBIT', className: 'top-[52%] left-[10%] -rotate-[9deg]' },
  ] as const

  return (
    <section className="hidden w-[45%] shrink-0 flex-col bg-brand-soft px-10 py-14 md:flex lg:w-[55%] lg:px-16">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-strong text-white">
          <Heart size={20} strokeWidth={1.75} fill="currentColor" />
        </span>
        <span className="font-display text-[36px] leading-none text-brand-text">daty</span>
      </div>

      <div className="relative my-8 min-h-0 flex-1" aria-hidden="true">
        <div className="absolute inset-x-[8%] top-[18%] bottom-[18%] rounded-3xl border-[3px] border-brand-tint bg-cream" />
        <div className="absolute inset-x-[8%] top-1/2 h-5 -translate-y-1/2 bg-brand-tint" />
        {prints.map(({ category, className }) => {
          const { Icon } = categoryOf(category)
          const [from, to] = PHOTO_GRADIENTS[category][0]!
          return (
            <div key={category} className={`absolute h-44 w-36 rounded-[10px] bg-surface p-2.5 pb-9 shadow-photo ${className}`}>
              <div className="flex size-full items-center justify-center rounded-md" style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}>
                <Icon size={40} strokeWidth={1.5} className="text-white" />
              </div>
            </div>
          )
        })}
        <MapPin size={44} strokeWidth={1.75} className="absolute top-[30%] left-[46%] fill-white text-brand-text" />
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className="font-display text-[34px] leading-[1.3]">
          {t.auth.heroTitle[0]}
          <br />
          {t.auth.heroTitle[1]}
        </h2>
        <p className="text-[15px] text-muted">{t.auth.heroBody}</p>
      </div>
    </section>
  )
}
