import { Check, MapPin, Plus } from 'lucide-react'
import timelineConnector from '../../assets/icons/timeline-connector.svg'
import { CategoryIcon } from '../../components/CategoryIcon'
import { MemoText } from '../../components/Memo'
import { PixelSprite } from '../../components/PixelSprite'
import { Stars } from '../../components/Stars'
import { errorMessage } from '../../lib/api'
import { daysBetween, isSameDay, toTimeInput } from '../../lib/dates'
import { RISE_IN, riseDelay } from '../../lib/motion'
import { useUpdateRecord } from '../../lib/queries'
import type { DateRecord } from '../../lib/types'
import type { Milestone } from '../../lib/anniversary'
import { useT } from '../../lib/i18n'
import { useIsRetro } from '../../lib/theme'

export function DayTimeline({
  day,
  today,
  records,
  milestones,
  onEdit,
  onComplete,
  onAddNext,
}: {
  day: Date
  today: Date
  records: DateRecord[]
  milestones: Milestone[]
  /** Another stop for the day, starting (HH:MM) when the last one ends. */
  onAddNext: (time: string) => void
  onEdit: (record: DateRecord) => void
  /** A plan was marked as done (it is now a record). */
  onComplete: (record: DateRecord) => void
}) {
  const t = useT()
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between leading-normal">
        <h2 className="font-display text-[20px]">
          {t.calendar.dayHeading(t.dates.monthDay(day), t.weekdays[day.getDay()]!)}
          {isSameDay(day, today) && ` · ${t.calendar.today}`}
        </h2>
        <span className="text-[12px] text-muted">{t.calendar.scheduleCount(records.length)}</span>
      </div>

      {milestones.map((m) => (
        <p
          key={`${m.kind}-${m.count}`}
          className="ui-box-thin rounded-2xl bg-amber-soft px-4 py-3 text-[14px] font-semibold text-amber-ink retro:text-[12px]"
        >
          {t.calendar.milestoneDay(t.calendar.milestone(m))}
        </p>
      ))}

      {records.length === 0 ? (
        <p className="ui-empty rounded-2xl bg-surface/60 py-8 text-center text-[13px] text-muted">{t.calendar.empty}</p>
      ) : (
        records.map((r, i) => (
          <TimelineEntry key={r.id} index={i} record={r} today={today} onEdit={() => onEdit(r)} onComplete={onComplete} />
        ))
      )}

      {records.length > 0 && (
        <button
          type="button"
          onClick={() => onAddNext(nextStopTime(records.at(-1)!))}
          className="ui-btn-thin flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/50 text-[13px] font-semibold text-brand-text retro:border-0 retro:bg-surface retro:text-[12px]"
        >
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          {t.calendar.addNextStop}
        </button>
      )}
    </section>
  )
}

const HOUR_MS = 60 * 60 * 1000

/** Where the next stop starts: when the last one ends, or an hour after it started (not past 23:00). */
function nextStopTime(last: DateRecord) {
  const start = new Date(last.scheduledAt)
  const next = last.endsAt ? new Date(last.endsAt) : new Date(start.getTime() + HOUR_MS)
  return next.getDate() === start.getDate() ? toTimeInput(next) : '23:00'
}

function TimelineEntry({
  record,
  index,
  today,
  onEdit,
  onComplete,
}: {
  record: DateRecord
  /** Position in the day, for the order the entries rise in. */
  index: number
  today: Date
  onEdit: () => void
  onComplete: (record: DateRecord) => void
}) {
  const t = useT()
  const retro = useIsRetro()
  const complete = useUpdateRecord(record.id)
  const at = new Date(record.scheduledAt)
  const isPlan = record.type === 'PLAN'
  const dDay = daysBetween(today, at)
  const mapUrl = record.place?.googleMapsUrl
  // A plan can be finished once its day has come.
  const canComplete = isPlan && dDay <= 0

  return (
    <div className={`flex items-start gap-1 ${RISE_IN}`} style={riseDelay(index)}>
      <span className="flex w-11 shrink-0 flex-col pt-3.5 text-right text-[12px] leading-normal font-semibold text-muted">
        {toTimeInput(at)}
        {record.endsAt && <span className="text-[11px] font-normal">~{toTimeInput(new Date(record.endsAt))}</span>}
      </span>
      {isPlan ? (
        <img src={timelineConnector} alt="" width={18} height={28} className="shrink-0" />
      ) : (
        <span className="relative h-7 w-[18px] shrink-0">
          <span className="absolute left-2 h-5 w-0.5 bg-chip-border" />
          <span className="absolute top-4 left-[3px] size-3 rounded-full bg-brand ring-2 ring-white" />
        </span>
      )}
      <article
        role="button"
        tabIndex={0}
        aria-label={t.calendar.editSchedule(record.place?.name ?? record.title)}
        onClick={onEdit}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onEdit())}
        className={`ui-box-thin flex min-w-0 flex-1 cursor-pointer flex-col rounded-2xl border bg-surface p-3.5 text-left retro:mt-1 ${
          isPlan ? 'border-coral/30 retro:[--pixel-border:var(--color-coral)]' : 'border-card-border'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] leading-normal font-semibold text-brand-text">
            <CategoryIcon category={record.category} size={12} /> {t.categories[record.category]}
          </span>
          {isPlan ? (
            <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] leading-normal font-bold text-coral-strong">
              {t.calendar.dDay(dDay)}
            </span>
          ) : (
            record.rating !== null && <Stars value={record.rating} />
          )}
        </div>
        <h3 className="pt-1 font-display text-[17px] leading-[1.375]">{record.place?.name ?? record.title}</h3>
        {record.memo && <MemoText content={record.memo} className="pt-1 text-[13px] leading-[1.75] whitespace-pre-line text-ink/75" />}
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex max-w-full items-center gap-1 self-start pt-2 text-[11px] leading-normal font-medium text-brand-text"
          >
            <MapPin size={12} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{mapUrl.replace(/^https?:\/\//, '')}</span>
          </a>
        )}
        {canComplete && (
          <button
            type="button"
            disabled={complete.isPending}
            onClick={(e) => {
              e.stopPropagation()
              complete.mutate({ type: 'RECORD' }, { onSuccess: onComplete })
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="ui-btn-thin mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-strong text-[14px] font-semibold text-white disabled:opacity-50 retro:text-[13px]"
          >
            {!complete.isPending && (retro ? <PixelSprite name="check" scale={2} colors={{ k: 'var(--color-white)' }} /> : <Check size={16} strokeWidth={1.75} />)}
            {complete.isPending ? t.calendar.completing : t.calendar.complete}
          </button>
        )}
        {complete.error && (
          <p className="pt-2 text-[12px] text-coral-strong">
            {t.calendar.completeFailed}: {errorMessage(complete.error, t)}
          </p>
        )}
      </article>
    </div>
  )
}
