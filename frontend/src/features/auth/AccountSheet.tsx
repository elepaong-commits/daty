import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { useLogout, useMe } from '../../lib/queries'

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const me = useMe().data
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
    <BottomSheet title="내 정보" onClose={onClose}>
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
            <p className="text-[12px] leading-normal font-semibold text-muted">짝꿍</p>
            {partner ? (
              <p className="pt-1 text-[15px] font-semibold">💞 {partner.nickname}</p>
            ) : (
              <>
                <p className="pt-1 text-[13px] leading-normal">아직 짝꿍이 연결되지 않았어요. 이 코드를 알려 주세요.</p>
                <button
                  type="button"
                  onClick={() => copyCode(couple.coupleCode)}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-brand-soft px-4 py-3"
                >
                  <span className="text-[20px] font-bold tracking-[6px] text-brand-strong">{couple.coupleCode}</span>
                  <span className="text-[12px] font-semibold text-brand">{copied ? '복사했어요' : '복사'}</span>
                </button>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="h-12 w-full rounded-2xl bg-sand-soft text-[15px] font-semibold text-ink"
        >
          로그아웃
        </button>
      </div>
    </BottomSheet>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand font-display text-white ${
        size === 'sm' ? 'size-7 text-[13px]' : 'size-11 text-[18px]'
      }`}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}
