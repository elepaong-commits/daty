import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Field, inputClass } from '../../components/Field'
import { categoryOf } from '../../lib/categories'
import { daysBetween, formatSlashDay, fromInputs, parseDateOnly, rangesOverlap, toDateInput, toTimeInput } from '../../lib/dates'
import { errorMessage } from '../../lib/api'
import { useAlbums, usePlaces, useRangeRecords } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import type { Album, PlaceCategory } from '../../lib/types'
import type { NewAlbumDraft } from './CreateAlbumSheet'
import { SavedPlacePicker } from '../records/SavedPlacePicker'

export interface AlbumFormValues {
  title: string
  albumDate: string
  albumEndDate: string | null // null for a one-day album
  highlightNote: string // trimmed; empty when there is none
  recordIds: number[]
  placeIds: number[] // saved places to add as visits on the first day
  visitAt: string
}

interface Props {
  /** The album being edited; a new album starts empty on today. */
  album?: Album
  /** Starting values for a new album, e.g. from a date just marked as done. */
  draft?: NewAlbumDraft
  submitLabel: string
  isPending: boolean
  error: Error | null
  footer?: ReactNode
  onSubmit: (values: AlbumFormValues) => void
}

/** Album name, its day or span of days, the visits it bundles and its highlight — shared by the create and edit sheets. */
export function AlbumForm({ album, draft, submitLabel, isPending, error, footer, onSubmit }: Props) {
  const t = useT()
  const [title, setTitle] = useState(album?.title ?? draft?.title ?? '')
  const [date, setDate] = useState(album?.albumDate ?? draft?.albumDate ?? toDateInput(new Date()))
  const [endDate, setEndDate] = useState(album?.albumEndDate ?? date)
  const [highlight, setHighlight] = useState(album?.highlightNote ?? '')
  const [picked, setPicked] = useState<Set<number>>(new Set(album?.recordIds ?? (draft && [draft.recordId])))
  const [placeIds, setPlaceIds] = useState<number[]>([])
  const [choosingPlaces, setChoosingPlaces] = useState(false)
  const { data: places = [] } = usePlaces()
  const { data: albums = [] } = useAlbums()
  const multiDay = date !== '' && endDate > date
  const days = multiDay ? daysBetween(parseDateOnly(date), parseDateOnly(endDate)) + 1 : 1
  // One album per day: point at the album already holding one of these days instead of starting another.
  const dayAlbum = date ? albums.find((a) => a.id !== album?.id && rangesOverlap(a.albumDate, a.albumEndDate, date, endDate)) : undefined

  // Offer the visits on the chosen days so the album shows where it was taken.
  const from = date || toDateInput(new Date())
  const { data: rangeRecords = [] } = useRangeRecords(from, multiDay ? endDate : from)
  const dayRecords = rangeRecords.filter((r) => {
    const day = toDateInput(new Date(r.scheduledAt))
    return r.type === 'RECORD' && (r.albumId === null || r.albumId === album?.id) && day >= from && day <= (multiDay ? endDate : from)
  })

  // A place already visited in a checked record doesn't need another visit.
  const visitedPlaceIds = new Set(dayRecords.filter((r) => picked.has(r.id)).map((r) => r.placeId))
  const pickable = places.filter((p) => !visitedPlaceIds.has(p.id))
  const addedPlaces = pickable.filter((p) => placeIds.includes(p.id))

  const canSave = title.trim() !== '' && date !== '' && !dayAlbum && !isPending

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePlace(id: number) {
    setPlaceIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    onSubmit({
      title: title.trim(),
      albumDate: date,
      albumEndDate: multiDay ? endDate : null,
      highlightNote: highlight.trim(),
      recordIds: [...picked].filter((id) => dayRecords.some((r) => r.id === id)),
      placeIds: addedPlaces.map((p) => p.id),
      visitAt: fromInputs(date, '12:00').toISOString(),
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={t.albums.name}>
        <input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.albums.namePlaceholder} className={inputClass} />
      </Field>
      {/* A day, or a span of days for a trip: the end follows the start until it's moved on its own. */}
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-[12px] leading-normal font-semibold text-muted">
          {t.albums.period}
          <span className="ui-badge">{multiDay ? t.albums.tripLength(days - 1, days) : t.albums.oneDay}</span>
          {multiDay && (
            <button type="button" onClick={() => setEndDate(date)} className="ml-auto text-[12px] font-semibold text-brand">
              {t.albums.makeOneDay}
            </button>
          )}
        </span>
        <div className="flex items-center gap-2">
          <input
            required
            type="date"
            aria-label={t.common.date}
            value={date}
            onChange={(e) => {
              const next = e.target.value
              if (!multiDay || endDate < next) setEndDate(next)
              setDate(next)
              setPicked(new Set())
            }}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <span className="text-muted">~</span>
          <input
            type="date"
            aria-label={t.albums.period}
            value={endDate}
            min={date}
            onChange={(e) => setEndDate(e.target.value && e.target.value >= date ? e.target.value : date)}
            className={`${inputClass} min-w-0 flex-1`}
          />
        </div>
      </div>
      {dayAlbum && (
        <p className="-mt-2 flex flex-col gap-1 rounded-xl bg-coral-soft px-3 py-2 text-[12px] text-coral-strong">
          {multiDay ? t.albums.periodTaken : t.albums.dayTaken}
          <Link to={`/albums/${dayAlbum.id}`} className="self-start font-semibold text-brand">
            {t.albums.openDayAlbum(dayAlbum.title)}
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] leading-normal font-semibold text-muted">{multiDay ? t.albums.periodRecords : t.albums.dayRecords}</span>
        {dayRecords.length === 0 && addedPlaces.length === 0 && (
          <p className="text-[12px] text-muted">{multiDay ? t.albums.noPeriodRecords : t.albums.noDayRecords}</p>
        )}
        {dayRecords.map((r) => (
          <label key={r.id} className="flex items-center gap-2 rounded-xl border border-field-border bg-field px-3 py-2.5 text-[14px]">
            <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="accent-brand" />
            <span className="text-muted">
              {multiDay && `${formatSlashDay(new Date(r.scheduledAt))} `}
              {toTimeInput(new Date(r.scheduledAt))}
            </span>
            <CategoryIcon category={r.category} />
            {r.place?.name ?? r.title}
          </label>
        ))}
        {addedPlaces.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-xl border border-brand bg-brand-soft px-3 py-2.5 text-[14px]">
            <span className="text-[11px] font-semibold text-brand-strong">{t.albums.newVisit}</span>
            <CategoryIcon category={p.category} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <button type="button" onClick={() => togglePlace(p.id)} className="text-[12px] font-semibold text-muted">
              {t.albums.removePlace}
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setChoosingPlaces((on) => !on)}
          className="h-9 self-start rounded-full bg-sand-soft px-3 text-[12px] font-semibold text-brand"
        >
          {choosingPlaces ? t.albums.closePlaces : t.albums.addPlaces}
        </button>
        {choosingPlaces && (
          <SavedPlacePicker places={pickable} selectedIds={placeIds} onSelect={(place) => togglePlace(place.id)} />
        )}
        {addedPlaces.length > 0 && <p className="text-[11px] text-brand">{multiDay ? t.albums.newVisitHintPeriod : t.albums.newVisitHint}</p>}
      </div>

      <Field label={t.common.mustSee}>
        <input maxLength={300} value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder={t.albums.highlightPlaceholder} className={inputClass} />
      </Field>

      {footer}

      {error && <p className="text-[12px] text-coral-strong">{t.common.saveFailed}: {errorMessage(error, t)}</p>}

      <button
        type="submit"
        disabled={!canSave}
        className="ui-btn h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none retro:mb-1.5 retro:text-[14px]"
      >
        {isPending ? t.common.saving : submitLabel}
      </button>
    </form>
  )
}

function CategoryIcon({ category }: { category: PlaceCategory }) {
  const { Icon } = categoryOf(category)
  return <Icon size={14} strokeWidth={1.75} className="shrink-0 text-brand-strong" />
}
