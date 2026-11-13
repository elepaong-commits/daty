import { Heart } from 'lucide-react'
import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { ThemeToggle } from '../../components/SettingToggles'
import { useLogout, useMe } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import { NotificationSettings } from './NotificationSettings'
import { ChangePassword, PartnerResetCode } from './PasswordSettings'
import { ProfileSettings } from './ProfileSettings'
import { DataExport, StorageUsage } from './StorageSettings'

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const me = useMe().data
  const t = useT()
  const logout = useLogout()
  const [copied, setCopied] = useState(false)
  if (!me) return null

  const { user, couple } = me
  const partner = couple?.users.find((u) => u.id !== user.id)

  async function copyCode(code: string) {
    await navigator.clipboard?.writeText(code)
    setCopied(true)
  }

  return (
    <BottomSheet title={t.common.myInfo} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-2xl bg-field p-4">
          <Avatar name={user.nickname} />
          <div className="min-w-0">
            <p className="font-display text-[18px] leading-normal">{user.nickname}</p>
            <p className="truncate text-[12px] text-muted">{user.email}</p>
          </div>
        </div>

        {couple && (
          <div className="rounded-2xl border border-card-border p-4">
            <p className="text-[12px] leading-normal font-semibold text-muted">{t.account.partner}</p>
            {partner ? (
              <p className="flex items-center gap-1.5 pt-1 text-[15px] font-semibold">
                <Heart size={15} strokeWidth={1.75} className="text-coral" /> {partner.nickname}
              </p>
            ) : (
              <>
                <p className="pt-1 text-[13px] leading-normal">{t.account.noPartner}</p>
                <button
                  type="button"
                  onClick={() => copyCode(couple.coupleCode)}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-brand-soft px-4 py-3"
                >
                  <span className="text-[20px] font-bold tracking-[6px] text-brand-strong">{couple.coupleCode}</span>
                  <span className="text-[12px] font-semibold text-brand-strong">{copied ? t.account.copied : t.account.copy}</span>
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-card-border p-4">
          <p className="text-[12px] leading-normal font-semibold text-muted">{t.theme.label}</p>
          <ThemeToggle />
        </div>

        <NotificationSettings />
        {couple && <StorageUsage />}

        <ProfileSettings me={me} />
        <ChangePassword />
        {partner && <PartnerResetCode partnerName={partner.nickname} />}
        {couple && <DataExport />}

        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="h-12 w-full rounded-2xl bg-sand-soft text-[15px] font-semibold text-ink"
        >
          {t.account.logout}
        </button>
      </div>
    </BottomSheet>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-strong font-display text-white retro:rounded-none retro:font-pixel retro:pixel-outline retro:pixel-thin retro:pixel-crisp ${
        size === 'sm' ? 'size-7 text-[13px]' : 'size-11 text-[18px]'
      }`}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}
