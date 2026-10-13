import { createContext, use } from 'react'
import type { Lang, Messages } from './messages'

export { LANGS, type Lang, type Messages } from './messages'

const STORAGE_KEY = 'daty.lang'

/** The language picked on this device, else the browser's (Japanese or Korean). */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ko' || saved === 'ja') return saved
  } catch {
    // Storage can be blocked (private mode); fall through to the browser language.
  }
  return navigator.language.startsWith('ja') ? 'ja' : 'ko'
}

/** Language the page loaded in. Google Maps can only be loaded once, so its tiles keep this language. */
export const BOOT_LANG = initialLang()

export function rememberLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Not remembered across visits, but the switch still works for this session.
  }
}

export const I18nContext = createContext<{ lang: Lang; t: Messages; setLang: (lang: Lang) => void } | null>(null)

export function useI18n() {
  const value = use(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}

export const useT = () => useI18n().t
