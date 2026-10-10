import { NavLink, useLocation } from 'react-router'

// `paths` lists the screens under each tab, so a detail page keeps its tab highlighted.
const ITEMS = [
  { to: '/', paths: ['/', '/places'], emoji: '🗺️', label: '메인' },
  { to: '/calendar', paths: ['/calendar'], emoji: '📅', label: '캘린더' },
  { to: '/albums', paths: ['/albums'], emoji: '🖼️', label: '앨범' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  const isUnder = (paths: string[]) =>
    paths.some((path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)))

  return (
    <nav className="flex shrink-0 border-t border-sand bg-white pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
      {ITEMS.map(({ to, paths, emoji, label }) => (
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
                {label}
              </span>
            </>
            )
          }}
        </NavLink>
      ))}
    </nav>
  )
}
