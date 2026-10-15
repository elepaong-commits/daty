import { useLocation } from 'react-router'
import type { Messages } from './i18n'
import type { SpriteName } from './sprites'

// `paths` lists the screens under each tab, so a detail page keeps its tab highlighted.
export const NAV_ITEMS: { to: string; paths: string[]; sprite: SpriteName; key: keyof Messages['nav'] }[] = [
  { to: '/', paths: ['/', '/places'], sprite: 'map', key: 'map' },
  { to: '/calendar', paths: ['/calendar'], sprite: 'calendar', key: 'calendar' },
  { to: '/albums', paths: ['/albums'], sprite: 'photo', key: 'albums' },
]

/** Whether the current screen belongs to the tab with these `paths`. */
export function useIsUnder() {
  const { pathname } = useLocation()
  return (paths: string[]) => paths.some((path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)))
}
