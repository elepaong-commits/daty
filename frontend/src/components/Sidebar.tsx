import { Settings } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { AccountSheet } from '../features/auth/AccountSheet'
import { ScheduleSheet } from '../features/records/ScheduleSheet'
import { daysTogether, formatDotted, parseDateOnly, toDateInput } from '../lib/dates'
import { useT } from '../lib/i18n'
import { enterSpring } from '../lib/motion'
import { NAV_ITEMS, useIsUnder } from '../lib/nav'
import { useMe } from '../lib/queries'
import { PixelSprite } from './PixelSprite'
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
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex size-9 items-center justify-center bg-brand pixel-outline pixel-thin">
          <PixelSprite name="heart" scale={2} />
        </span>
        <span className="font-pixel-head text-[30px] leading-none text-brand pixel-crisp">daty</span>
      </div>

      <div className="flex flex-col bg-cream p-4 pixel-box">
        <div className="flex items-end gap-1.5">
          <PixelSprite name="rabbit" scale={2} />
          <PixelSprite name="heart" scale={2} className="mb-2" />
          <PixelSprite name="bear" scale={2} />
        </div>
        <span className="truncate pt-3 font-pixel text-[12px] leading-normal pixel-crisp">
          {partner ? `${user.nickname} ♥ ${partner.nickname}` : user.nickname}
        </span>
        <span className="pt-1 font-pixel-head text-[30px] leading-none text-coral pixel-crisp">D+{daysTogether(couple.anniversaryDate)}</span>
        <span className="pt-1.5 font-pixel text-[11px] leading-normal text-muted pixel-crisp">
          {t.sidebar.since(formatDotted(parseDateOnly(couple.anniversaryDate)))}
        </span>
      </div>

      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map(({ to, paths, sprite, key }) => {
          const active = isUnder(paths)
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`relative isolate flex h-[44px] items-center gap-3 px-3 font-pixel text-[12px] pixel-crisp ${
                active ? 'text-brand-strong' : 'text-ink hover:bg-sand-soft'
              }`}
            >
              {/* Slides over to the tab that opens, with the menu cursor riding along. */}
              {active && (
                <m.span layoutId="sidebar-highlight" transition={enterSpring} className="absolute inset-0 -z-10 bg-brand-soft pixel-outline pixel-thin">
                  <PixelSprite name="cursor" scale={2} className="absolute top-1/2 -left-3.5 -translate-y-1/2 motion-safe:animate-pixel-nudge" />
                </m.span>
              )}
              <PixelSprite name={sprite} scale={2} />
              {t.nav[key]}
            </NavLink>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={() => setScheduling(true)}
        className="flex h-11 items-center justify-center gap-2 bg-brand font-pixel text-[12px] text-white pixel-btn pixel-crisp hover:bg-brand-strong"
      >
        <PixelSprite name="plus" scale={2} />
        {t.calendar.addSchedule}
      </button>

      <div className="mt-auto flex flex-col gap-3">
        <div className="self-start">
          <LanguageToggle />
        </div>
        <button
          type="button"
          onClick={() => setAccount(true)}
          className="flex items-center gap-2.5 bg-white p-2.5 text-left pixel-outline pixel-thin [--pixel-border:var(--color-handle)] hover:bg-sand-soft"
          aria-label={t.common.myInfo}
        >
          <Initial name={user.nickname} size={34} className="bg-brand-soft text-brand-strong" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-pixel text-[12px] pixel-crisp">{user.nickname}</span>
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
      className={`flex shrink-0 items-center justify-center font-pixel text-[12px] pixel-outline pixel-thin pixel-crisp ${className}`}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}
