import { NavLink, useLocation } from 'react-router'
import { type Messages, useT } from '../lib/i18n'

// `paths` lists the screens under each tab, so a detail page keeps its tab highlighted.
const ITEMS: { to: string; paths: string[]; emoji: string; key: keyof Messages['nav'] }[] = [
  { to: '/', paths: ['/', '/places'], emoji: '🗺️', key: 'map' },
  { to: '/calendar', paths: ['/calendar'], emoji: '📅', key: 'calendar' },
  { to: '/albums', paths: ['/albums'], emoji: '🖼️', key: 'albums' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  const t = useT()
  const isUnder = (paths: string[]) =>
    paths.some((path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)))

  return (
    <nav className="flex shrink-0 border-t border-sand bg-white pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
      {ITEMS.map(({ to, paths, emoji, key }) => (
        <NavLink key={to} to={to} className="flex flex-1 flex-col items-center gap-1">
          {() => {
            const isActive = isUnder(paths)
            return (
            <>
              <span
                className={`flex h-8 items-center justify-center rounded-full text-[20px] leading-none ${
                  isActive ? 'w-[70.4px] bg-brand-soft' : 'w-16 opacity-60'
                }`}
              >
                {emoji}
              </span>
              <span className={`text-[11px] leading-normal font-semibold ${isActive ? 'text-brand' : 'text-faint'}`}>
                {t.nav[key]}
              </span>
            </>
            )
          }}
        </NavLink>
      ))}
    </nav>
  )
}
