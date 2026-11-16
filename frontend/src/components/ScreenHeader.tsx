import { AnimatePresence } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { AccountSheet, Avatar } from '../features/auth/AccountSheet'
import { useT } from '../lib/i18n'
import { useMe } from '../lib/queries'
import { LanguageToggle } from './SettingToggles'

interface Props {
  eyebrow: string
  title: string
  actions?: ReactNode
  children?: ReactNode
}

export function ScreenHeader({ eyebrow, title, actions, children }: Props) {
  return (
    <header className="shrink-0 px-5 pt-4 pb-3 md:pt-8 md:pb-5">
      {/* Room between the profile/language row and the title row's buttons below it. */}
      <div className="flex items-center justify-between pb-2.5">
        <p className="ui-eyebrow">{eyebrow}</p>
        {/* On desktop these live in the sidebar; the tablet rail has room for the account only. */}
        <div className="flex items-center gap-2 lg:hidden">
          <span className="flex md:hidden">
            <AccountButton />
          </span>
          <LanguageToggle />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="ui-title">{title}</h1>
        {actions}
      </div>
      {children}
    </header>
  )
}

function AccountButton() {
  const t = useT()
  const user = useMe().data?.user
  const nickname = user?.nickname
  const [open, setOpen] = useState(false)
  if (!nickname) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t.common.myInfo}>
        <Avatar name={nickname} src={user?.profileImageUrl} size="sm" />
      </button>
      <AnimatePresence>{open && <AccountSheet onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}
