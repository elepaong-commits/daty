import { useState, type FormEvent, type ReactNode } from 'react'
import { Field, PasswordInput } from '../../components/Field'
import { errorMessage } from '../../lib/api'
import { useDeleteAccount, useLeaveCouple, useRemovePartner } from '../../lib/queries'
import { useT } from '../../lib/i18n'

type Action = 'remove' | 'leave' | 'delete'

/**
 * Leaving the couple, removing the partner and deleting the account. Each opens in place with what it
 * does to the records and a red confirm button; deleting also asks for the password.
 */
export function MembershipSettings({ inCouple, partnerName }: { inCouple: boolean; partnerName: string | null }) {
  const t = useT()
  const [open, setOpen] = useState<Action | null>(null)
  const remove = useRemovePartner()
  const leave = useLeaveCouple()
  const deleteAccount = useDeleteAccount()
  const [password, setPassword] = useState('')

  const show = (action: Action | null) => {
    remove.reset()
    leave.reset()
    deleteAccount.reset()
    setPassword('')
    setOpen(action)
  }

  function submitDelete(e: FormEvent) {
    e.preventDefault()
    if (password !== '' && !deleteAccount.isPending) deleteAccount.mutate({ password })
  }

  const actions: { action: Action; label: string; shown: boolean }[] = [
    { action: 'remove', label: partnerName ? t.account.removePartner(partnerName) : '', shown: partnerName !== null },
    { action: 'leave', label: t.account.leaveCouple, shown: inCouple },
    { action: 'delete', label: t.account.deleteAccount, shown: true },
  ]

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-card-border p-4">
      <p className="text-[12px] leading-normal font-semibold text-muted">{t.account.membershipTitle}</p>
      {actions
        .filter((a) => a.shown)
        .map(({ action, label }) =>
          open !== action ? (
            <button
              key={action}
              type="button"
              onClick={() => show(action)}
              className="flex h-11 w-full items-center justify-between rounded-xl bg-sand-soft px-4 text-[14px] font-semibold"
            >
              {label}
              <span className="text-muted">›</span>
            </button>
          ) : action === 'remove' && partnerName ? (
            <Confirm
              key={action}
              body={t.account.removePartnerBody(partnerName)}
              confirmLabel={t.account.confirmRemove}
              pending={remove.isPending}
              error={remove.error}
              onCancel={() => show(null)}
              onConfirm={() => remove.mutate(undefined, { onSuccess: () => show(null) })}
            />
          ) : action === 'leave' ? (
            <Confirm
              key={action}
              body={t.account.leaveCoupleBody(partnerName)}
              confirmLabel={t.account.confirmLeave}
              pending={leave.isPending}
              error={leave.error}
              onCancel={() => show(null)}
              onConfirm={() => leave.mutate()}
            />
          ) : (
            <form key={action} onSubmit={submitDelete}>
              <Confirm
                body={t.account.deleteAccountBody(inCouple ? partnerName : null)}
                confirmLabel={t.account.confirmDelete}
                pending={deleteAccount.isPending}
                disabled={password === ''}
                error={deleteAccount.error}
                onCancel={() => show(null)}
                submit
              >
                <Field label={t.account.deletePassword}>
                  <PasswordInput
                    required
                    maxLength={72}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              </Confirm>
            </form>
          ),
        )}
    </div>
  )
}

function Confirm({
  body,
  confirmLabel,
  pending,
  disabled = false,
  error,
  onCancel,
  onConfirm,
  submit = false,
  children,
}: {
  body: string
  confirmLabel: string
  pending: boolean
  disabled?: boolean
  error: Error | null
  onCancel: () => void
  onConfirm?: () => void
  submit?: boolean
  children?: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-coral-soft p-4" role="group" aria-label={confirmLabel}>
      <p className="ui-prose text-[13px] leading-[1.6] text-ink">{body}</p>
      {children}
      {error && <p className="text-[12px] text-danger">{errorMessage(error, t)}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl bg-white text-[14px] font-semibold">
          {t.common.cancel}
        </button>
        <button
          type={submit ? 'submit' : 'button'}
          onClick={submit ? undefined : onConfirm}
          disabled={pending || disabled}
          className="h-11 flex-1 rounded-xl bg-danger text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? t.common.wait : confirmLabel}
        </button>
      </div>
    </div>
  )
}
