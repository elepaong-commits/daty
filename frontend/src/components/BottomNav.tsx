import { m } from 'motion/react'
import { NavLink } from 'react-router'
import { useT } from '../lib/i18n'
import { enterSpring } from '../lib/motion'
import { NAV_ITEMS, useIsUnder } from '../lib/nav'

/** Phone tab bar; the desktop layout uses `Sidebar` instead. The highlight slides over to the tab that opens. */
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
                className={`relative flex h-8 w-[70.4px] items-center justify-center transition-colors duration-200 ${
                  isActive ? 'text-brand' : 'text-faint'
                }`}
              >
                {isActive && (
                  <m.span layoutId="bottom-nav-highlight" transition={enterSpring} className="absolute inset-0 rounded-full bg-brand-soft" />
                )}
                <Icon size={20} strokeWidth={1.75} className="relative" />
              </span>
              <span
                className={`text-[11px] leading-normal font-semibold transition-colors duration-200 ${isActive ? 'text-brand' : 'text-faint'}`}
              >
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
