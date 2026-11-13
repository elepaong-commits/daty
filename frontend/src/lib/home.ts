import { BOOT_LANG } from './i18n'

const HOMES = {
  KR: { region: 'KR', center: { lat: 37.5563, lng: 126.9906 } }, // Seoul
  JP: { region: 'JP', center: { lat: 35.6812, lng: 139.7671 } }, // Tokyo
} as const

/**
 * Where this device is used, for what the map leans towards: the default view before any place is
 * saved, and which country wins when a search matches places in several. Read from the time zone,
 * which follows the phone abroad better than the app language does; the language decides elsewhere.
 */
export function homeOf(timeZone: string | undefined, lang: string) {
  if (timeZone === 'Asia/Tokyo') return HOMES.JP
  if (timeZone === 'Asia/Seoul') return HOMES.KR
  return lang === 'ja' ? HOMES.JP : HOMES.KR
}

export const HOME = homeOf(Intl.DateTimeFormat().resolvedOptions().timeZone, BOOT_LANG)
