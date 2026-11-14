import { useState, type FormEvent } from 'react'
import { Field, inputClass } from '../../components/Field'
import { errorMessage } from '../../lib/api'
import { toDateInput } from '../../lib/dates'
import { useUpdateCouple, useUpdateMe } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import type { Me } from '../../lib/types'

/** Edit your nickname and, once connected, the couple's anniversary (which drives D+N). */
export function ProfileSettings({ me }: { me: Me }) {
  const t = useT()
  const updateMe = useUpdateMe()
  const updateCouple = useUpdateCouple()
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nickname, setNickname] = useState(me.user.nickname)
  const [anniversary, setAnniversary] = useState(me.couple?.anniversaryDate ?? '')

  const pending = updateMe.isPending || updateCouple.isPending
  const error = updateMe.error ?? updateCouple.error
  const nicknameChanged = nickname.trim() !== me.user.nickname
  const anniversaryChanged = me.couple !== null && anniversary !== me.couple.anniversaryDate
  const canSubmit = nickname.trim() !== '' && (me.couple === null || anniversary !== '') && (nicknameChanged || anniversaryChanged)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || pending) return
    try {
      if (nicknameChanged) await updateMe.mutateAsync({ nickname: nickname.trim() })
      if (anniversaryChanged) await updateCouple.mutateAsync({ anniversaryDate: anniversary })
    } catch {
      return // shown below from the mutation's error
    }
    setSaved(true)
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            updateMe.reset()
            updateCouple.reset()
            setNickname(me.user.nickname)
            setAnniversary(me.couple?.anniversaryDate ?? '')
            setSaved(false)
            setOpen(true)
          }}
          className="flex h-11 w-full items-center justify-between rounded-2xl border border-card-border px-4 text-[14px] font-semibold"
        >
          {t.account.editProfile}
          <span className="text-muted">›</span>
        </button>
        {saved && <p className="px-1 text-[12px] text-brand-text">{t.account.profileSaved}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-card-border p-4">
      <p className="text-[14px] font-semibold">{t.account.editProfile}</p>
      <Field label={t.auth.nickname}>
        <input
          required
          maxLength={20}
          autoComplete="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className={inputClass}
        />
      </Field>
      {me.couple && (
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
      )}
      {error && <p className="text-[12px] text-coral-strong">{errorMessage(error, t)}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-11 flex-1 rounded-xl bg-sand-soft text-[14px] font-semibold">
          {t.common.cancel}
        </button>
        <button
          type="submit"
          disabled={!canSubmit || pending}
          className="h-11 flex-1 rounded-xl bg-brand-strong text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? t.common.saving : t.common.saveChanges}
        </button>
      </div>
    </form>
  )
}
