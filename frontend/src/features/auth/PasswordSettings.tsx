import { useState, type FormEvent } from 'react'
import { Field, PasswordInput } from '../../components/Field'
import { errorMessage } from '../../lib/api'
import { formatDotted, toTimeInput } from '../../lib/dates'
import { useChangePassword, useIssueResetCode } from '../../lib/queries'
import { useT } from '../../lib/i18n'

/** Change your own password; other devices get logged out. */
export function ChangePassword() {
  const t = useT()
  const change = useChangePassword()
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const canSubmit = currentPassword !== '' && newPassword.length >= 8

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || change.isPending) return
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('')
          setNewPassword('')
          setOpen(false)
        },
      },
    )
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            change.reset()
            setOpen(true)
          }}
          className="flex h-11 w-full items-center justify-between rounded-2xl border border-card-border px-4 text-[14px] font-semibold"
        >
          {t.account.changePassword}
          <span className="text-muted">›</span>
        </button>
        {change.isSuccess && <p className="px-1 text-[12px] text-brand">{t.account.passwordChanged}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-card-border p-4">
      <p className="text-[14px] font-semibold">{t.account.changePassword}</p>
      <Field label={t.account.currentPassword}>
        <PasswordInput
          required
          maxLength={72}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </Field>
      <Field label={t.account.newPassword}>
        <PasswordInput
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </Field>
      {change.error && <p className="text-[12px] text-coral-strong">{errorMessage(change.error, t)}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-11 flex-1 rounded-xl bg-sand-soft text-[14px] font-semibold">
          {t.common.cancel}
        </button>
        <button
          type="submit"
          disabled={!canSubmit || change.isPending}
          className="h-11 flex-1 rounded-xl bg-brand text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {change.isPending ? t.common.wait : t.account.submitPassword}
        </button>
      </div>
    </form>
  )
}

/** Makes a one-time code the partner types on the login screen when they forgot their password. */
export function PartnerResetCode({ partnerName }: { partnerName: string }) {
  const t = useT()
  const issue = useIssueResetCode()
  const issued = issue.data
  const expiresAt = issued && new Date(issued.expiresAt)

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-card-border p-4">
      <p className="text-[12px] leading-normal font-semibold text-muted">{t.account.resetCodeTitle(partnerName)}</p>
      {issued && expiresAt ? (
        <>
          <p className="rounded-xl bg-brand-soft px-4 py-3 text-center text-[22px] font-bold tracking-[6px] text-brand-strong select-all">
            {issued.code}
          </p>
          <p className="text-[12px] leading-normal text-muted">
            {t.account.resetCodeHelp(issued.user.nickname, `${formatDotted(expiresAt)} ${toTimeInput(expiresAt)}`)}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => issue.mutate()}
          disabled={issue.isPending}
          className="h-11 w-full rounded-xl bg-sand-soft text-[14px] font-semibold disabled:opacity-50"
        >
          {issue.isPending ? t.common.wait : t.account.issueResetCode}
        </button>
      )}
      {issue.error && <p className="text-[12px] text-coral-strong">{errorMessage(issue.error, t)}</p>}
    </div>
  )
}
