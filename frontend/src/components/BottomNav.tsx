import { NavLink } from 'react-router'
import { useT } from '../lib/i18n'
import { NAV_ITEMS, useIsUnder } from '../lib/nav'

/** Phone tab bar; the desktop layout uses `Sidebar` instead. */
export function BottomNav() {
  const isUnder = useIsUnder()
  const t = useT()

  return (
    <nav className="flex shrink-0 border-t border-sand bg-white pt-2 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden">
      {NAV_ITEMS.map(({ to, paths, Icon, key }) => (
        <NavLink key={to} to={to} className="flex flex-1 flex-col items-center gap-1">
          {() => {
            const isActive = isUnder(paths)
            return (
            <>
              <span
                className={`flex h-8 items-center justify-center rounded-full ${
                  isActive ? 'w-[70.4px] bg-brand-soft text-brand' : 'w-16 text-faint'
                }`}
              >
                <Icon size={20} strokeWidth={1.75} />
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
