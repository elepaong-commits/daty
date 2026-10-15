import { useEffect, useState, type ReactNode } from 'react'
import { applyTheme, BOOT_THEME, rememberTheme, ThemeContext, type Theme } from '../lib/theme'

/** Holds the design; switching restyles every screen in place. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(BOOT_THEME)

  useEffect(() => {
    applyTheme(theme)
    if (theme) rememberTheme(theme)
  }, [theme])

  return <ThemeContext value={{ theme: theme ?? 'classic', chosen: theme !== null, setTheme }}>{children}</ThemeContext>
}

/**
 * Shows its children in one design whatever the page uses, for the previews on the start screen.
 * The page itself has no design yet there, so only `retro` needs marking.
 */
export function ThemeScope({ theme, children, className }: { theme: Theme; children: ReactNode; className?: string }) {
  return (
    <ThemeContext value={{ theme, chosen: true, setTheme: () => {} }}>
      <div data-theme={theme === 'retro' ? 'retro' : undefined} className={className}>
        {children}
      </div>
    </ThemeContext>
  )
}
