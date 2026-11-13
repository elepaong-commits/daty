import { useState, type FormEvent } from 'react'
import { Field, inputClass } from '../../components/Field'
import { LanguageToggle } from '../../components/SettingToggles'
import { errorMessage } from '../../lib/api'
import { toDateInput } from '../../lib/dates'
import { useCreateCouple, useJoinCouple, useLogout, useMe } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import { MembershipSettings } from './MembershipSettings'

type Mode = 'create' | 'join'

/** Shown after signup until the user creates a couple or joins their partner's. */
export function CoupleSetupPage() {
  const nickname = useMe().data?.user.nickname
  const t = useT()
  const [mode, setMode] = useState<Mode>('create')
  const createCouple = useCreateCouple()
  const joinCouple = useJoinCouple()
  const logout = useLogout()
  const [anniversary, setAnniversary] = useState('')
  const [code, setCode] = useState('')
  const [showDelete, setShowDelete] = useState(false)

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
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div className="pb-8">
        <p className="text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand-strong">{t.couple.hello(nickname ?? '')}</p>
        <h1 className="font-display text-[26px] leading-[1.25]">{t.couple.title}</h1>
        <p className="pt-2 text-[13px] leading-normal text-muted">
          {t.couple.description}
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
            className={`flex-1 rounded-xl text-[14px] font-semibold ${mode === value ? 'bg-white text-brand-strong' : 'text-ink'}`}
          >
            {value === 'create' ? t.couple.createTab : t.couple.joinTab}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-card">
        {mode === 'create' ? (
          <Field label={t.couple.anniversary}>
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
          <Field label={t.couple.inviteCode}>
            <input
              required
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t.couple.codePlaceholder}
              className={`${inputClass} text-center text-[18px] font-semibold tracking-[6px]`}
            />
          </Field>
        )}

        {active.error && <p className="text-[12px] text-coral-strong">{errorMessage(active.error, t)}</p>}

        <button
          type="submit"
          disabled={!canSubmit || active.isPending}
          className="ui-btn h-12 w-full rounded-2xl bg-brand-strong text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none retro:mb-1.5 retro:text-[14px]"
        >
          {active.isPending ? t.common.wait : mode === 'create' ? t.couple.create : t.couple.join}
        </button>
      </form>

      <button type="button" onClick={() => logout.mutate()} className="mt-6 self-center text-[12px] text-muted underline">
        {t.couple.otherAccount}
      </button>
      {showDelete ? (
        <div className="mt-4">
          <MembershipSettings inCouple={false} partnerName={null} />
        </div>
      ) : (
        <button type="button" onClick={() => setShowDelete(true)} className="mt-3 self-center text-[12px] text-muted underline">
          {t.account.deleteAccount}
        </button>
      )}
    </div>
  )
}
