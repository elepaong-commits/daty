import { AnimatePresence } from 'motion/react'
import { useState, type ReactNode } from 'react'
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
        <p className="flex items-center gap-1.5 font-pixel text-[11px] leading-normal text-brand pixel-crisp">
          <span className="size-1.5 bg-brand" aria-hidden="true" />
          {eyebrow}
        </p>
        {/* On desktop these live in the sidebar. */}
        <div className="flex items-center gap-2 lg:hidden">
          <AccountButton />
          <LanguageToggle />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-pixel text-[24px] leading-[1.25] pixel-crisp lg:font-pixel-head lg:text-[30px]">{title}</h1>
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
      <AnimatePresence>{open && <AccountSheet onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="flex h-6 items-center bg-white pixel-outline pixel-thin" role="group" aria-label={t.common.language}>
      {LANGS.map(({ value, short }) => (
        <button
          key={value}
          type="button"
          lang={value}
          onClick={() => setLang(value)}
          aria-pressed={lang === value}
          className={`flex h-6 w-8 items-center justify-center font-pixel text-[11px] pixel-crisp ${
            lang === value ? 'bg-ink text-white' : 'text-ink'
          }`}
        >
          {short}
        </button>
      ))}
    </div>
  )
}
