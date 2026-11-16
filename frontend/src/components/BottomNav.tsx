import { m } from 'motion/react'
import { NavLink } from 'react-router'
import { useT } from '../lib/i18n'
import { useMotionPreset } from '../lib/motion'
import { NAV_ITEMS, useIsUnder } from '../lib/nav'
import { useIsRetro } from '../lib/theme'
import { PixelSprite } from './PixelSprite'

/** Phone tab bar; tablets and desktop use `Sidebar` instead. The highlight slides over to the tab that opens. */
export function BottomNav() {
  const isUnder = useIsUnder()
  const t = useT()
  const retro = useIsRetro()
  const { highlight } = useMotionPreset()

  // Pixel design: three tiles on dark grid lines, the open one filled.
  if (retro) {
    return (
      <nav className="flex shrink-0 gap-[3px] bg-night pt-[3px] md:hidden">
        {NAV_ITEMS.map(({ to, paths, sprite, key }) => {
          const isActive = isUnder(paths)
          return (
            <NavLink
              key={to}
              to={to}
              className={`relative isolate flex flex-1 flex-col items-center gap-1 bg-beige pt-2 pb-[max(8px,env(safe-area-inset-bottom))] font-pixel text-[11px] leading-none pixel-crisp ${
                isActive ? 'text-white' : 'text-ink'
              }`}
            >
              {isActive && <m.span layoutId="bottom-nav-highlight" transition={highlight} className="absolute inset-0 -z-10 bg-brand-strong" />}
              <PixelSprite name={sprite} scale={2} />
              {t.nav[key]}
            </NavLink>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="flex shrink-0 border-t border-sand bg-surface pt-2 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden">
      {NAV_ITEMS.map(({ to, paths, Icon, key }) => (
        <NavLink key={to} to={to} className="flex flex-1 flex-col items-center gap-1">
          {() => {
            const isActive = isUnder(paths)
            return (
            <>
              <span
                className={`relative flex h-8 w-[70.4px] items-center justify-center transition-colors duration-200 ${
                  isActive ? 'text-brand-text' : 'text-faint'
                }`}
              >
                {isActive && (
                  <m.span layoutId="bottom-nav-highlight" transition={highlight} className="absolute inset-0 rounded-full bg-brand-soft" />
                )}
                <Icon size={20} strokeWidth={1.75} className="relative" />
              </span>
              <span
                className={`text-[11px] leading-normal font-semibold transition-colors duration-200 scrap:font-display scrap:text-[15px] scrap:leading-none scrap:font-bold ${isActive ? 'text-brand-text' : 'text-faint'}`}
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
