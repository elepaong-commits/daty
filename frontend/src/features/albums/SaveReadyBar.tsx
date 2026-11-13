import { useT } from '../../lib/i18n'
import type { useSaveFiles } from '../../lib/useSaveFiles'

/** Phones: a batch of files is ready; the share sheet only opens from a tap, so this asks for one. */
export function SaveReadyBar({ saver, dark = false }: { saver: ReturnType<typeof useSaveFiles>; dark?: boolean }) {
  const t = useT()
  const { state } = saver
  if (state.phase !== 'ready') return null
  return (
    <div
      role="status"
      className={`ui-box-thin flex items-center gap-2 rounded-2xl p-2 pl-3.5 ${dark ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand-strong'}`}
    >
      <p className="min-w-0 flex-1 text-[13px] font-semibold">{t.albums.saveReady(state.count, state.done, state.total)}</p>
      <button type="button" onClick={saver.cancel} className="ui-btn-thin h-9 rounded-xl px-3 text-[13px] font-semibold">
        {t.common.cancel}
      </button>
      <button
        type="button"
        onClick={saver.share}
        className="ui-btn-thin h-9 rounded-xl bg-brand-strong px-3.5 text-[13px] font-semibold text-white"
      >
        {t.albums.saveReadyButton}
      </button>
    </div>
  )
}
