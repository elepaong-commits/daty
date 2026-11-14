import { createContext, use } from 'react'

export type Theme = 'classic' | 'retro'
export const THEMES: Theme[] = ['classic', 'retro']

const STORAGE_KEY = 'daty.theme'

/** The design picked on this device, or null before any pick (the classic design is shown then). */
function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'classic' || saved === 'retro') return saved
  } catch {
    // Storage can be blocked (private mode); ask again on the next visit.
  }
  return null
}

export const BOOT_THEME = savedTheme()

export function rememberTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Not remembered across visits, but the switch still works for this session.
  }
}

/**
 * Marks the page with the design so CSS can restyle it (`retro:` variant and the `ui-*` classes in
 * `index.css`). Called before the first render too, so a saved design shows without a flash.
 */
export function applyTheme(theme: Theme | null) {
  if (theme) document.documentElement.dataset.theme = theme
  else delete document.documentElement.dataset.theme
}

export const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null)

export function useTheme() {
  const value = use(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

/** For the few places that draw different things per design (icons, pins, mascots); styling belongs in CSS. */
export const useIsRetro = () => useTheme().theme === 'retro'
