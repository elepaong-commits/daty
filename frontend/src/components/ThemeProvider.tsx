import { useEffect, useState, type ReactNode } from 'react'
import { applyColorMode, savedColorMode } from '../lib/colorMode'
import { applyTheme, BOOT_THEME, rememberTheme, ThemeContext, type Theme } from '../lib/theme'

/** Holds the design; switching restyles every screen in place. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(BOOT_THEME)

  useEffect(() => {
    applyTheme(theme)
    // The ground colour differs between designs; the browser's bar colour follows it.
    applyColorMode(savedColorMode())
    if (theme) rememberTheme(theme)
  }, [theme])

  return <ThemeContext value={{ theme: theme ?? 'classic', setTheme }}>{children}</ThemeContext>
}
