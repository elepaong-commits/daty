import timelineConnector from '../../assets/icons/timeline-connector.svg'
import { Stars } from '../../components/Stars'
import { categoryOf } from '../../lib/categories'
import { daysBetween, isSameDay, toTimeInput } from '../../lib/dates'
import type { DateRecord } from '../../lib/types'
import { useT } from '../../lib/i18n'

export function DayTimeline({
  day,
  today,
  records,
  onEdit,
}: {
  day: Date
  today: Date
  records: DateRecord[]
  onEdit: (record: DateRecord) => void
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

      {records.length === 0 ? (
        <p className="rounded-2xl bg-white/60 py-8 text-center text-[13px] text-muted">{t.calendar.empty}</p>
      ) : (
        records.map((r) => <TimelineEntry key={r.id} record={r} today={today} onEdit={() => onEdit(r)} />)
      )}
    </section>
  )
}

function TimelineEntry({ record, today, onEdit }: { record: DateRecord; today: Date; onEdit: () => void }) {
  const t = useT()
  const at = new Date(record.scheduledAt)
  const isPlan = record.type === 'PLAN'
  const category = categoryOf(record.category)
  const dDay = daysBetween(today, at)
  const mapUrl = record.place?.googleMapsUrl

  return (
    <div className="flex items-start gap-1">
      <span className="w-11 shrink-0 pt-3.5 text-right text-[12px] leading-normal font-semibold text-muted">{toTimeInput(at)}</span>
      {isPlan ? (
        <img src={timelineConnector} alt="" width={18} height={28} className="shrink-0" />
      ) : (
        <span className="relative h-7 w-[18px] shrink-0">
          <span className="absolute left-2 h-5 w-0.5 bg-[#e8e3d1]" />
          <span className="absolute top-4 left-[3px] size-3 rounded-full bg-brand ring-2 ring-white" />
        </span>
      )}
      <article
        role="button"
        tabIndex={0}
        aria-label={t.calendar.editSchedule(record.place?.name ?? record.title)}
        onClick={onEdit}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onEdit())}
        className={`flex min-w-0 flex-1 cursor-pointer flex-col rounded-2xl border bg-white p-3.5 text-left ${isPlan ? 'border-coral/30' : 'border-card-border'}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] leading-normal font-semibold text-brand-strong">
            {category.emoji} {t.categories[category.value]}
          </span>
          {isPlan ? (
            <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] leading-normal font-bold text-coral">
              {t.calendar.dDay(dDay)}
            </span>
          ) : (
            record.rating !== null && <Stars value={record.rating} />
          )}
        </div>
        <h3 className="pt-1 font-display text-[17px] leading-[1.375]">{record.place?.name ?? record.title}</h3>
        {record.memo && <p className="pt-1 text-[13px] leading-[1.625] text-ink/75">📝 {record.memo}</p>}
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="self-start truncate pt-2 text-[11px] leading-normal font-medium text-brand"
          >
            📍 {mapUrl.replace(/^https?:\/\//, '')}
          </a>
        )}
      </article>
    </div>
  )
}
