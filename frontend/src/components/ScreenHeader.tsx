import { useState, type ReactNode } from 'react'
import globeIcon from '../assets/icons/globe.svg'
import { AccountSheet, Avatar } from '../features/auth/AccountSheet'
import { useMe } from '../lib/queries'

interface Props {
  eyebrow: string
  title: string
  actions?: ReactNode
  children?: ReactNode
}

export function ScreenHeader({ eyebrow, title, actions, children }: Props) {
  return (
    <header className="shrink-0 px-5 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand">{eyebrow}</p>
        <div className="flex items-center gap-2">
          <AccountButton />
          <LanguageToggle />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[26px] leading-[1.25]">{title}</h1>
        {actions}
      </div>
      {children}
    </header>
  )
}

function AccountButton() {
  const nickname = useMe().data?.user.nickname
  const [open, setOpen] = useState(false)
  if (!nickname) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="내 정보">
        <Avatar name={nickname} size="sm" />
      </button>
      {open && <AccountSheet onClose={() => setOpen(false)} />}
    </>
  )
}

// Japanese is planned but not translated yet, so only Korean is selectable for now.
function LanguageToggle() {
  return (
    <div className="flex h-7 items-center gap-0.5 rounded-full bg-white py-0.5 pr-0.5 pl-2" role="group" aria-label="언어">
      <img src={globeIcon} alt="" width={13} height={13} />
      <span className="flex h-6 w-7 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white" aria-current="true">
        한
      </span>
      <span className="flex h-6 w-7 items-center justify-center text-[11px] font-bold text-muted" title="일본어는 준비 중이에요" aria-disabled="true">
        日
      </span>
    </div>
  )
}
