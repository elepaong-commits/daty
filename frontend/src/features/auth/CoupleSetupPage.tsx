import { useState, type FormEvent } from 'react'
import { Field, inputClass } from '../../components/Field'
import { errorMessage } from '../../lib/api'
import { toDateInput } from '../../lib/dates'
import { useCreateCouple, useJoinCouple, useLogout, useMe } from '../../lib/queries'

type Mode = 'create' | 'join'

/** Shown after signup until the user creates a couple or joins their partner's. */
export function CoupleSetupPage() {
  const nickname = useMe().data?.user.nickname
  const [mode, setMode] = useState<Mode>('create')
  const createCouple = useCreateCouple()
  const joinCouple = useJoinCouple()
  const logout = useLogout()
  const [anniversary, setAnniversary] = useState('')
  const [code, setCode] = useState('')

  const active = mode === 'create' ? createCouple : joinCouple
  const canSubmit = mode === 'create' ? anniversary !== '' : code.trim().length === 6

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || active.isPending) return
    if (mode === 'create') createCouple.mutate({ anniversaryDate: anniversary })
    else joinCouple.mutate({ code: code.trim().toUpperCase() })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-10">
      <div className="pb-8">
        <p className="text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand">반가워요, {nickname}님</p>
        <h1 className="font-display text-[26px] leading-[1.25]">짝꿍과 연결해 주세요</h1>
        <p className="pt-2 text-[13px] leading-normal text-muted">
          한 사람이 커플을 만들고, 나온 초대 코드를 상대가 입력하면 기록을 함께 볼 수 있어요.
        </p>
      </div>

      <div className="mb-5 flex h-11 gap-2 rounded-2xl bg-segment p-1" role="tablist">
        {(['create', 'join'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`flex-1 rounded-xl text-[14px] font-semibold ${mode === value ? 'bg-white text-brand' : 'text-ink'}`}
          >
            {value === 'create' ? '💞 커플 만들기' : '🔑 코드 입력'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-card">
        {mode === 'create' ? (
          <Field label="우리가 사귄 날">
            <input
              required
              type="date"
              max={toDateInput(new Date())}
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
              className={inputClass}
            />
          </Field>
        ) : (
          <Field label="짝꿍에게 받은 초대 코드">
            <input
              required
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="예) H8BMZ5"
              className={`${inputClass} text-center text-[18px] font-semibold tracking-[6px]`}
            />
          </Field>
        )}

        {active.error && <p className="text-[12px] text-coral-strong">{errorMessage(active.error)}</p>}

        <button
          type="submit"
          disabled={!canSubmit || active.isPending}
          className="h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none"
        >
          {active.isPending ? '잠시만요…' : mode === 'create' ? '커플 만들기' : '연결하기'}
        </button>
      </form>

      <button type="button" onClick={() => logout.mutate()} className="mt-6 self-center text-[12px] text-muted underline">
        다른 계정으로 로그인
      </button>
    </div>
  )
}
