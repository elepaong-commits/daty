import globeIcon from '../assets/icons/globe.svg'
import { LANGS, useI18n, useT } from '../lib/i18n'
import { COLOR_MODES, useColorMode } from '../lib/colorMode'
import { THEMES, useTheme } from '../lib/theme'

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="ui-segment pl-2 retro:pl-0" role="group" aria-label={t.common.language}>
      <img src={globeIcon} alt="" width={13} height={13} className="retro:hidden" />
      {LANGS.map(({ value, short }) => (
        <button
          key={value}
          type="button"
          lang={value}
          onClick={() => setLang(value)}
          aria-pressed={lang === value}
          className="ui-segment-option"
        >
          {short}
        </button>
      ))}
    </div>
  )
}

/** Switches between the designs (classic, pixel, scrapbook) on this device. */
export function ThemeToggle() {
  const t = useT()
  const { theme, setTheme } = useTheme()
  return (
    <div className="ui-segment" role="group" aria-label={t.theme.label}>
      {THEMES.map((value) => (
        <button key={value} type="button" onClick={() => setTheme(value)} aria-pressed={theme === value} className="ui-segment-option">
          {t.theme.names[value]}
        </button>
      ))}
    </div>
  )
}

/** Light, dark, or following the system, on this device. */
export function ColorModeToggle() {
  const t = useT()
  const [mode, setMode] = useColorMode()
  return (
    <div className="ui-segment" role="group" aria-label={t.theme.modeLabel}>
      {COLOR_MODES.map((value) => (
        <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value} className="ui-segment-option">
          {t.theme.modes[value]}
        </button>
      ))}
    </div>
  )
}
