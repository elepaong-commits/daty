import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import backIcon from '../assets/icons/back.svg'
import { useT } from '../lib/i18n'
import { useIsRetro } from '../lib/theme'
import { PixelSprite } from './PixelSprite'

interface Props {
  eyebrow: string
  title: string
  /** Where "back" goes when there is no history entry (e.g. the page was opened from a link). */
  fallback: string
  action?: ReactNode
}

/** Header for screens below a tab: back button, title and one secondary action. */
export function SubHeader({ eyebrow, title, fallback, action }: Props) {
  const navigate = useNavigate()
  const t = useT()
  const retro = useIsRetro()
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback, { replace: true }))

  return (
    <header className="flex shrink-0 flex-col gap-2 px-5 pt-3.5 pb-4">
      <p className="ui-eyebrow">{eyebrow}</p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={back} className="ui-icon-button size-9 bg-white" aria-label={t.common.back}>
          {retro ? <PixelSprite name="left" scale={2} /> : <img src={backIcon} alt="" width={18} height={18} />}
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-[26px] leading-[1.25] retro:font-pixel retro:text-[24px] retro:pixel-crisp lg:retro:font-display lg:retro:text-[30px]">{title}</h1>
        {action}
      </div>
    </header>
  )
}

export function HeaderAction({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ui-btn-thin h-9 shrink-0 rounded-full bg-white px-3 text-[13px] font-semibold text-brand disabled:opacity-50 retro:h-8 retro:text-[12px] retro:text-brand-strong"
    >
      {children}
    </button>
  )
}
