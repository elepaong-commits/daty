import { Heart, Plus, Settings } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { AccountSheet } from '../features/auth/AccountSheet'
import { ScheduleSheet } from '../features/records/ScheduleSheet'
import { daysTogether, formatDotted, parseDateOnly, toDateInput } from '../lib/dates'
import { useT } from '../lib/i18n'
import { useMotionPreset } from '../lib/motion'
import { NAV_ITEMS, useIsUnder } from '../lib/nav'
import { useIsRetro } from '../lib/theme'
import { useMe } from '../lib/queries'
import { PixelSprite } from './PixelSprite'
import { LanguageToggle, ThemeToggle } from './SettingToggles'

/**
 * Navigation column. On desktop: the couple, the three tabs, "add schedule", language and account.
 * On tablets (`md` to `lg`) it narrows to a rail of icons: tabs, "add schedule" and the account.
 */
export function Sidebar() {
  const t = useT()
  const me = useMe().data
  const isUnder = useIsUnder()
  const navigate = useNavigate()
  const retro = useIsRetro()
  const { highlight } = useMotionPreset()
  const [scheduling, setScheduling] = useState(false)
  const [account, setAccount] = useState(false)
  if (!me?.couple) return null

  const { user, couple } = me
  const partner = couple.users.find((u) => u.id !== user.id)

  return (
    <aside className="hidden w-[76px] shrink-0 flex-col gap-6 border-r border-sand bg-surface px-2 pt-5 pb-5 md:flex lg:w-[240px] lg:px-4 lg:pt-7">
      <div className="flex items-center justify-center gap-2 lg:justify-start lg:px-2 retro:gap-2.5 lg:retro:px-1">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-brand-strong text-white retro:size-9 retro:rounded-none retro:pixel-outline retro:pixel-thin">
          {retro ? <PixelSprite name="heart" scale={2} /> : <Heart size={17} strokeWidth={1.75} fill="currentColor" />}
        </span>
        <span className="hidden font-display text-[28px] leading-none text-brand-text lg:inline retro:font-pixel-head retro:text-[30px] retro:pixel-crisp">daty</span>
      </div>

      <div className="hidden flex-col rounded-[20px] border border-card-border bg-cream p-4 lg:flex retro:rounded-none retro:border-0 retro:pixel-box">
        {retro ? (
          <>
            <div className="flex items-end gap-1.5">
              <PixelSprite name="rabbit" scale={2} />
              <PixelSprite name="heart" scale={2} className="mb-2 motion-safe:animate-pixel-beat" />
              <PixelSprite name="bear" scale={2} />
            </div>
            <span className="truncate pt-3 font-pixel text-[12px] leading-normal pixel-crisp">
              {partner ? `${user.nickname} ♥ ${partner.nickname}` : user.nickname}
            </span>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex">
              <Initial name={user.nickname} src={user.profileImageUrl} className="bg-brand-soft text-brand-text" />
              {partner && <Initial name={partner.nickname} src={partner.profileImageUrl} className="-ml-2 bg-coral-soft text-coral-strong" />}
            </div>
            <span className="min-w-0 truncate text-[11px] font-semibold text-muted">
              {partner ? `${user.nickname} ♥ ${partner.nickname}` : user.nickname}
            </span>
          </div>
        )}
        <span className="pt-3 font-display text-[30px] leading-[1.1] retro:pt-1 retro:font-pixel-head retro:leading-none retro:text-coral-strong retro:pixel-crisp">
          D+{daysTogether(couple.anniversaryDate)}
        </span>
        <span className="pt-0.5 text-[12px] text-muted retro:pt-1.5 retro:font-pixel retro:text-[11px] retro:pixel-crisp">
          {t.sidebar.since(formatDotted(parseDateOnly(couple.anniversaryDate)))}
        </span>
      </div>

      <nav className="flex flex-col gap-1 retro:gap-2">
        {NAV_ITEMS.map(({ to, paths, Icon, sprite, key }) => {
          const active = isUnder(paths)
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`relative isolate flex h-[58px] flex-col items-center justify-center gap-1 rounded-[14px] text-[11px] font-semibold transition-colors duration-200 lg:h-[46px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:text-[15px] retro:rounded-none retro:font-pixel retro:text-[11px] retro:font-normal retro:pixel-crisp lg:retro:h-11 lg:retro:px-3 lg:retro:text-[12px] ${
                active ? 'text-brand-text retro:text-brand-text' : 'text-muted hover:bg-sand-soft hover:text-ink retro:text-ink'
              }`}
            >
              {/* Slides over to the tab that opens (in the pixel design with the menu cursor riding along). */}
              {active && (
                <m.span
                  layoutId="sidebar-highlight"
                  transition={highlight}
                  className="absolute inset-0 -z-10 rounded-[14px] bg-brand-soft retro:rounded-none retro:pixel-outline retro:pixel-thin"
                >
                  {retro && (
                    <PixelSprite name="cursor" scale={2} className="absolute top-1/2 -left-3.5 hidden -translate-y-1/2 motion-safe:animate-pixel-nudge lg:block" />
                  )}
                </m.span>
              )}
              {retro ? <PixelSprite name={sprite} scale={2} /> : <Icon size={20} strokeWidth={1.75} />}
              {t.nav[key]}
            </NavLink>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={() => setScheduling(true)}
        className="ui-cta flex w-[50px] items-center justify-center gap-1.5 self-center lg:w-auto lg:self-stretch retro:w-11 lg:retro:w-auto"
        aria-label={t.calendar.addSchedule}
      >
        {retro ? <PixelSprite name="plus" scale={2} /> : <Plus size={18} strokeWidth={2.25} />}
        <span className="hidden lg:inline">{t.calendar.addSchedule}</span>
      </button>

      <button type="button" onClick={() => setAccount(true)} className="mt-auto self-center lg:hidden" aria-label={t.common.myInfo}>
        <Initial name={user.nickname} src={user.profileImageUrl} size={40} className="bg-brand-soft text-brand-text" />
      </button>

      <div className="mt-auto hidden flex-col gap-3 lg:flex">
        <div className="flex flex-wrap items-center gap-2 self-start retro:gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <button
          type="button"
          onClick={() => setAccount(true)}
          className="flex items-center gap-2.5 rounded-[14px] border border-card-border p-2.5 text-left hover:bg-sand-soft retro:rounded-none retro:border-0 retro:bg-surface retro:pixel-outline retro:pixel-thin retro:[--pixel-border:var(--color-handle)]"
          aria-label={t.common.myInfo}
        >
          <Initial name={user.nickname} src={user.profileImageUrl} size={34} className="bg-brand-soft text-brand-text" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-bold ui-label retro:text-[12px]">{user.nickname}</span>
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

function Initial({ name, src, size = 30, className }: { name: string; src: string | null; size?: number; className: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full border-2 border-white object-cover retro:rounded-none retro:border-0 retro:pixel-outline retro:pixel-thin ${className}`}
      />
    )
  }
  return (
    <span
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-white font-display text-[13px] retro:rounded-none retro:border-0 retro:font-pixel retro:text-[12px] retro:pixel-outline retro:pixel-thin retro:pixel-crisp ${className}`}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}
