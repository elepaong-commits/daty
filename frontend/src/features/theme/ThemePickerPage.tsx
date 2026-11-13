import { useState } from 'react'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Chip } from '../../components/Field'
import { LanguageToggle } from '../../components/SettingToggles'
import { Stars } from '../../components/Stars'
import { ThemeScope } from '../../components/ThemeProvider'
import { useT } from '../../lib/i18n'
import { THEMES, useTheme, type Theme } from '../../lib/theme'

/**
 * First screen on a device that hasn't picked a design: a live preview of each, side by side on
 * desktop. The pick is remembered on this device and can be changed later under "my info".
 */
export function ThemePickerPage() {
  const t = useT()
  const { setTheme } = useTheme()
  const [picked, setPicked] = useState<Theme>('classic')

  return (
    <div className="h-dvh overflow-y-auto bg-cream">
      <div className="mx-auto flex w-full max-w-[960px] flex-col px-5 pt-[max(20px,env(safe-area-inset-top))] lg:pt-12 lg:pb-12">
        <header className="flex items-center justify-between">
          <span className="font-display text-[28px] leading-none text-brand-strong">daty</span>
          <LanguageToggle />
        </header>

        <p className="pt-7 text-[11px] leading-normal font-semibold tracking-[1.54px] text-brand-strong">{t.theme.pickerEyebrow}</p>
        <h1 className="pt-1 font-display text-[26px] leading-[1.25] lg:text-[28px]">{t.theme.pickerTitle}</h1>
        <p className="pt-1.5 text-[13px] leading-normal text-muted">{t.theme.pickerHint}</p>

        <div role="radiogroup" aria-label={t.theme.label} className="grid gap-4 pt-6 lg:grid-cols-2 lg:gap-6">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={picked === theme}
              onClick={() => setPicked(theme)}
              className={`flex flex-col rounded-[22px] border-2 p-2.5 text-left transition-colors ${
                picked === theme ? 'border-brand bg-brand-soft' : 'border-card-border bg-white hover:border-brand/40'
              }`}
            >
              <ThemeScope theme={theme} className="overflow-hidden rounded-2xl bg-cream">
                <ThemePreview />
              </ThemeScope>
              <span className="flex items-center gap-2.5 px-1.5 pt-3 pb-1">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    picked === theme ? 'border-brand' : 'border-faint'
                  }`}
                >
                  {picked === theme && <span className="size-2.5 rounded-full bg-brand" />}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-[18px] leading-normal">{t.theme.names[theme]}</span>
                  <span className="text-[12px] leading-normal text-muted">{t.theme.descriptions[theme]}</span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Stays in reach at the bottom of a phone while the two previews scroll under it. */}
        <div className="sticky bottom-0 -mx-5 mt-2 bg-gradient-to-t from-cream from-70% px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:mt-6 lg:bg-none lg:p-0">
          <button
            type="button"
            onClick={() => setTheme(picked)}
            className="h-[52px] w-full rounded-full bg-brand-strong text-[15px] font-bold text-white shadow-cta hover:bg-brand-deep lg:mx-auto lg:block lg:w-[360px]"
          >
            {t.theme.start}
          </button>
        </div>
      </div>
    </div>
  )
}

/** A slice of the map screen drawn with the real components, so each preview is exactly what that design looks like. */
function ThemePreview() {
  const t = useT()
  return (
    <div inert className="flex flex-col gap-3 p-4 pb-5">
      <div>
        <p className="ui-eyebrow">{t.map.eyebrow(null)}</p>
        <p className="ui-title pt-1">{t.map.title}</p>
      </div>
      <div className="ui-tabs">
        <span className="ui-tab" aria-selected="true">
          {t.map.tab.VISITED(3)}
        </span>
        <span className="ui-tab" aria-selected="false">
          {t.map.tab.WISH(2)}
        </span>
      </div>
      <div className="flex gap-2 overflow-hidden pt-1 retro:gap-2.5">
        <Chip selected onClick={() => {}}>
          {t.map.all}
        </Chip>
        <Chip selected={false} onClick={() => {}}>
          <CategoryIcon category="CAFE" /> {t.categories.CAFE}
        </Chip>
        <Chip selected={false} onClick={() => {}}>
          <CategoryIcon category="FOOD" /> {t.categories.FOOD}
        </Chip>
      </div>
      <div className="ui-card flex flex-col gap-2 p-3.5 retro:mt-1" aria-pressed="true">
        <span className="ui-badge flex items-center gap-1 self-start">
          <CategoryIcon category="CAFE" size={12} /> {t.categories.CAFE}
        </span>
        <span className="ui-card-title truncate">{t.theme.samplePlace}</span>
        <span className="flex items-center gap-1.5">
          <Stars value={4.6} />
          <span className="ui-label text-[13px] font-bold retro:text-[12px]">4.6</span>
        </span>
      </div>
    </div>
  )
}
