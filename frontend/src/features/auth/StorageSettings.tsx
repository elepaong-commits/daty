import { useMutation } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { toDateInput } from '../../lib/dates'
import { saveBlob } from '../../lib/download'
import { formatBytes } from '../../lib/format'
import { useT } from '../../lib/i18n'
import { useStorage } from '../../lib/queries'

/** How full the photo storage is, against what the plan holds for free. */
export function StorageUsage() {
  const t = useT()
  const { data: usage } = useStorage()
  if (!usage) return null
  const percent = Math.min((usage.usedBytes / usage.freeBytes) * 100, 100)
  const over = usage.usedBytes > usage.freeBytes

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-card-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] leading-normal font-semibold text-muted">{t.storage.title}</p>
        <p className="text-[13px] font-semibold tabular-nums">{t.storage.used(formatBytes(usage.usedBytes), formatBytes(usage.freeBytes))}</p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-sand-soft retro:rounded-none"
        role="meter"
        aria-label={t.storage.title}
        aria-valuemin={0}
        aria-valuemax={usage.freeBytes}
        aria-valuenow={Math.min(usage.usedBytes, usage.freeBytes)}
        aria-valuetext={t.storage.used(formatBytes(usage.usedBytes), formatBytes(usage.freeBytes))}
      >
        <div className={`h-full ${over ? 'bg-coral-strong' : 'bg-brand'}`} style={{ width: `${Math.max(percent, usage.usedBytes > 0 ? 2 : 0)}%` }} />
      </div>
      <p className="text-[12px] leading-normal text-muted">
        {t.storage.breakdown(usage.photos.count, formatBytes(usage.photos.bytes), usage.videos.count, formatBytes(usage.videos.bytes))}
      </p>
      {usage.pending > 0 && <p className="text-[12px] leading-normal text-muted">{t.storage.pending(usage.pending)}</p>}
      {over && <p className="text-[12px] leading-normal text-coral-strong">{t.storage.over}</p>}
    </div>
  )
}

/** Saves everything the couple wrote as one file. */
export function DataExport() {
  const t = useT()
  const exportData = useMutation({
    mutationFn: api.exportData,
    onSuccess: (blob) => saveBlob(blob, `daty-${toDateInput(new Date())}.json`),
  })

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-card-border p-4">
      <p className="text-[12px] leading-normal font-semibold text-muted">{t.data.title}</p>
      <p className="text-[12px] leading-normal text-muted">{t.data.exportHelp}</p>
      <button
        type="button"
        onClick={() => exportData.mutate()}
        disabled={exportData.isPending}
        className="h-11 w-full rounded-xl bg-sand-soft text-[14px] font-semibold disabled:opacity-50"
      >
        {exportData.isPending ? t.common.wait : t.data.export}
      </button>
      {exportData.error && <p className="text-[12px] text-coral-strong">{errorMessage(exportData.error, t)}</p>}
    </div>
  )
}
