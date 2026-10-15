import { m } from 'motion/react'
import { NavLink } from 'react-router'
import { useT } from '../lib/i18n'
import { enterSpring } from '../lib/motion'
import { NAV_ITEMS, useIsUnder } from '../lib/nav'
import { PixelSprite } from './PixelSprite'

/** Phone tab bar; the desktop layout uses `Sidebar` instead. The highlight slides over to the tab that opens. */
export function BottomNav() {
  const isUnder = useIsUnder()
  const t = useT()

  return (
    <nav className="flex shrink-0 gap-[3px] bg-ink pt-[3px] lg:hidden">
      {NAV_ITEMS.map(({ to, paths, sprite, key }) => {
        const isActive = isUnder(paths)
        return (
          <NavLink
            key={to}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            className={`relative isolate flex flex-1 flex-col items-center gap-1 bg-beige pt-2 pb-[max(8px,env(safe-area-inset-bottom))] font-pixel text-[11px] leading-none pixel-crisp ${
              isActive ? 'text-white' : 'text-ink'
            }`}
          >
            {isActive && <m.span layoutId="bottom-nav-highlight" transition={enterSpring} className="absolute inset-0 -z-10 bg-brand" />}
            <PixelSprite name={sprite} scale={2} />
            {t.nav[key]}
          </NavLink>
        )
      })}
    </nav>
  )
}
