import { CalendarDays, Images, type LucideIcon, Map } from 'lucide-react'
import { useLocation } from 'react-router'
import type { Messages } from './i18n'

// `paths` lists the screens under each tab, so a detail page keeps its tab highlighted.
export const NAV_ITEMS: { to: string; paths: string[]; Icon: LucideIcon; key: keyof Messages['nav'] }[] = [
  { to: '/', paths: ['/', '/places'], Icon: Map, key: 'map' },
  { to: '/calendar', paths: ['/calendar'], Icon: CalendarDays, key: 'calendar' },
  { to: '/albums', paths: ['/albums'], Icon: Images, key: 'albums' },
]

/** Whether the current screen belongs to the tab with these `paths`. */
export function useIsUnder() {
  const { pathname } = useLocation()
  return (paths: string[]) => paths.some((path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)))
}
