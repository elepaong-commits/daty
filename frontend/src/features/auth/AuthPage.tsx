import { useState, type FormEvent } from 'react'
import { Field, inputClass } from '../../components/Field'
import { errorMessage } from '../../lib/api'
import { useLogin, useSignup } from '../../lib/queries'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const login = useLogin()
  const signup = useSignup()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')

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
      <div className="pb-8 text-center">
        <p className="text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand">우리 둘의 데이트 기록</p>
        <h1 className="font-display text-[44px] leading-[1.25]">daty</h1>
      </div>

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
            {value === 'login' ? '로그인' : '회원가입'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-card">
        {mode === 'signup' && (
          <Field label="닉네임">
            <input
              required
              maxLength={20}
              autoComplete="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예) 토끼"
              className={inputClass}
            />
          </Field>
        )}
        <Field label="이메일">
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
        <Field label={mode === 'signup' ? '비밀번호 (8자 이상)' : '비밀번호'}>
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

        {active.error && <p className="text-[12px] text-coral-strong">{errorMessage(active.error)}</p>}

        <button
          type="submit"
          disabled={!canSubmit || active.isPending}
          className="mt-1 h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none"
        >
          {active.isPending ? '잠시만요…' : mode === 'login' ? '로그인' : '가입하기'}
        </button>
      </form>
    </div>
  )
}
