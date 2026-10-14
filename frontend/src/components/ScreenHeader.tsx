import { useState, type ReactNode } from 'react'
import globeIcon from '../assets/icons/globe.svg'
import { AccountSheet, Avatar } from '../features/auth/AccountSheet'
import { LANGS, useI18n, useT } from '../lib/i18n'
import { useMe } from '../lib/queries'

interface Props {
  eyebrow: string
  title: string
  actions?: ReactNode
  children?: ReactNode
}

export function ScreenHeader({ eyebrow, title, actions, children }: Props) {
  return (
    <header className="shrink-0 px-5 pt-4 pb-3 lg:pt-8 lg:pb-5">
      {/* Room between the profile/language row and the title row's buttons below it. */}
      <div className="flex items-center justify-between pb-2.5">
        <p className="text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand">{eyebrow}</p>
        {/* On desktop these live in the sidebar. */}
        <div className="flex items-center gap-2 lg:hidden">
          <AccountButton />
          <LanguageToggle />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[26px] leading-[1.25] lg:text-[28px]">{title}</h1>
        {actions}
      </div>
      {children}
    </header>
  )
}

function AccountButton() {
  const t = useT()
  const nickname = useMe().data?.user.nickname
  const [open, setOpen] = useState(false)
  if (!nickname) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t.common.myInfo}>
        <Avatar name={nickname} size="sm" />
      </button>
      {open && <AccountSheet onClose={() => setOpen(false)} />}
    </>
  )
}

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="flex h-7 items-center gap-0.5 rounded-full bg-white py-0.5 pr-0.5 pl-2" role="group" aria-label={t.common.language}>
      <img src={globeIcon} alt="" width={13} height={13} />
      {LANGS.map(({ value, short }) => (
        <button
          key={value}
          type="button"
          lang={value}
          onClick={() => setLang(value)}
          aria-pressed={lang === value}
          className={`flex h-6 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
            lang === value ? 'bg-brand text-white' : 'text-muted'
          }`}
        >
          {short}
        </button>
      ))}
    </div>
  )
}
