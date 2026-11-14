import { useEffect, useState } from 'react'

// Light or dark colours, per device: follow the system, or pick one. Marked on <html data-mode> as the
// resolved `light`/`dark`, which the colour tokens in index.css switch on. Separate from the design
// (classic/pixel): either design comes in both.

export type ColorMode = 'system' | 'light' | 'dark'
export const COLOR_MODES: ColorMode[] = ['system', 'light', 'dark']

const STORAGE_KEY = 'daty.mode'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function savedColorMode(): ColorMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage blocked: follow the system.
  }
  return 'system'
}

/** Marks the page light or dark, and tells the browser (native pickers, scrollbars, the status bar). */
export function applyColorMode(mode: ColorMode) {
  const dark = mode === 'dark' || (mode === 'system' && darkQuery().matches)
  const root = document.documentElement
  root.dataset.mode = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
  const ground = getComputedStyle(root).getPropertyValue('--color-cream').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ground || (dark ? '#14181f' : '#fbf8ec'))
}

/** Applies the saved mode now and again whenever the system switches, while the mode is "system". */
export function watchColorMode() {
  applyColorMode(savedColorMode())
  darkQuery().addEventListener('change', () => applyColorMode(savedColorMode()))
}

/** The device's colour mode and a setter that applies and remembers it. */
export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(savedColorMode)
  useEffect(() => {
    applyColorMode(mode)
    try {
      if (mode === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Not remembered; still applied now.
    }
  }, [mode])
  return [mode, setMode] as const
}
