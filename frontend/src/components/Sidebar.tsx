import { Heart, Plus, Settings } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { AccountSheet } from '../features/auth/AccountSheet'
import { ScheduleSheet } from '../features/records/ScheduleSheet'
import { daysTogether, formatDotted, parseDateOnly, toDateInput } from '../lib/dates'
import { useT } from '../lib/i18n'
import { NAV_ITEMS, useIsUnder } from '../lib/nav'
import { useMe } from '../lib/queries'
import { LanguageToggle } from './ScreenHeader'

/** Desktop navigation column: the couple, the three tabs, "add schedule", language and account. */
export function Sidebar() {
  const t = useT()
  const me = useMe().data
  const isUnder = useIsUnder()
  const navigate = useNavigate()
  const [scheduling, setScheduling] = useState(false)
  const [account, setAccount] = useState(false)
  if (!me?.couple) return null

  const { user, couple } = me
  const partner = couple.users.find((u) => u.id !== user.id)

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col gap-6 border-r border-sand bg-white px-4 pt-7 pb-5 lg:flex">
      <div className="flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-brand text-white">
          <Heart size={17} strokeWidth={1.75} fill="currentColor" />
        </span>
        <span className="font-display text-[28px] leading-none text-brand">daty</span>
      </div>

      <div className="flex flex-col rounded-[20px] border border-card-border bg-cream p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex">
            <Initial name={user.nickname} className="bg-brand-soft text-brand-strong" />
            {partner && <Initial name={partner.nickname} className="-ml-2 bg-coral-soft text-coral-strong" />}
          </div>
          <span className="min-w-0 truncate text-[11px] font-semibold text-muted">
            {partner ? `${user.nickname} ♥ ${partner.nickname}` : user.nickname}
          </span>
        </div>
        <span className="pt-3 font-display text-[30px] leading-[1.1]">D+{daysTogether(couple.anniversaryDate)}</span>
        <span className="pt-0.5 text-[12px] text-muted">{t.sidebar.since(formatDotted(parseDateOnly(couple.anniversaryDate)))}</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, paths, Icon, key }) => {
          const active = isUnder(paths)
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex h-[46px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold ${
                active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-sand-soft hover:text-ink'
              }`}
            >
              <Icon size={20} strokeWidth={1.75} />
              {t.nav[key]}
            </NavLink>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={() => setScheduling(true)}
        className="flex h-[50px] items-center justify-center gap-1.5 rounded-full bg-brand text-[15px] font-bold text-white shadow-cta hover:bg-brand-strong"
      >
        <Plus size={18} strokeWidth={2.25} />
        {t.calendar.addSchedule}
      </button>

      <div className="mt-auto flex flex-col gap-3">
        <div className="self-start">
          <LanguageToggle />
        </div>
        <button
          type="button"
          onClick={() => setAccount(true)}
          className="flex items-center gap-2.5 rounded-[14px] border border-card-border p-2.5 text-left hover:bg-sand-soft"
          aria-label={t.common.myInfo}
        >
          <Initial name={user.nickname} size={34} className="bg-brand-soft text-brand-strong" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-bold">{user.nickname}</span>
            <span className="truncate text-[11px] text-muted">{user.email}</span>
          </span>
          <Settings size={18} strokeWidth={1.75} className="shrink-0 text-faint" />
        </button>
      </div>

      {scheduling && (
        <ScheduleSheet
          onClose={() => setScheduling(false)}
          onSaved={(at) => navigate('/calendar', { state: { focusDate: toDateInput(at) } })}
        />
      )}
      <AnimatePresence>{account && <AccountSheet onClose={() => setAccount(false)} />}</AnimatePresence>
    </aside>
  )
}

function Initial({ name, size = 30, className }: { name: string; size?: number; className: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-white font-display text-[13px] ${className}`}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}
