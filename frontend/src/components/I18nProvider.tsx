import { useEffect, useState, type ReactNode } from 'react'
import { BOOT_LANG, I18nContext, rememberLang, type Lang } from '../lib/i18n'
import { MESSAGES } from '../lib/messages'

/** Holds the UI language; switching re-renders every screen in place. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(BOOT_LANG)

  useEffect(() => {
    document.documentElement.lang = lang
    rememberLang(lang)
  }, [lang])

  return <I18nContext value={{ lang, t: MESSAGES[lang], setLang }}>{children}</I18nContext>
}
