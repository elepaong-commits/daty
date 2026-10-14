import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Field, inputClass } from '../../components/Field'
import { categoryOf } from '../../lib/categories'
import { fromInputs, parseDateOnly, toDateInput, toTimeInput } from '../../lib/dates'
import { errorMessage } from '../../lib/api'
import { useAlbums, useMonthRecords, usePlaces } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import type { Album } from '../../lib/types'
import type { NewAlbumDraft } from './CreateAlbumSheet'
import { SavedPlacePicker } from '../records/SavedPlacePicker'

export interface AlbumFormValues {
  title: string
  albumDate: string
  highlightNote: string // trimmed; empty when there is none
  recordIds: number[]
  placeIds: number[] // saved places to add as visits on that day
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

/** Album name, day, the visits it bundles and its highlight — shared by the create and edit sheets. */
export function AlbumForm({ album, draft, submitLabel, isPending, error, footer, onSubmit }: Props) {
  const t = useT()
  const [title, setTitle] = useState(album?.title ?? draft?.title ?? '')
  const [date, setDate] = useState(album?.albumDate ?? draft?.albumDate ?? toDateInput(new Date()))
  const [highlight, setHighlight] = useState(album?.highlightNote ?? '')
  const [picked, setPicked] = useState<Set<number>>(new Set(album?.recordIds ?? (draft && [draft.recordId])))
  const [placeIds, setPlaceIds] = useState<number[]>([])
  const [choosingPlaces, setChoosingPlaces] = useState(false)
  const { data: places = [] } = usePlaces()
  const { data: albums = [] } = useAlbums()
  // One album per day: point at the day's album instead of starting another.
  const dayAlbum = albums.find((a) => a.albumDate === date && a.id !== album?.id)

  // Offer the visits on the chosen day so the album shows where it was taken.
  const { data: monthRecords = [] } = useMonthRecords(parseDateOnly(date || toDateInput(new Date())))
  const dayRecords = monthRecords.filter(
    (r) =>
      r.type === 'RECORD' &&
      (r.albumId === null || r.albumId === album?.id) &&
      toDateInput(new Date(r.scheduledAt)) === date,
  )

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
      <Field label={t.common.date}>
        <input
          required
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setPicked(new Set())
          }}
          className={inputClass}
        />
      </Field>
      {dayAlbum && (
        <p className="-mt-2 flex flex-col gap-1 rounded-xl bg-coral-soft px-3 py-2 text-[12px] text-coral-strong">
          {t.albums.dayTaken}
          <Link to={`/albums/${dayAlbum.id}`} className="self-start font-semibold text-brand">
            {t.albums.openDayAlbum(dayAlbum.title)}
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] leading-normal font-semibold text-muted">{t.albums.dayRecords}</span>
        {dayRecords.length === 0 && addedPlaces.length === 0 && <p className="text-[12px] text-muted">{t.albums.noDayRecords}</p>}
        {dayRecords.map((r) => (
          <label key={r.id} className="flex items-center gap-2 rounded-xl border border-field-border bg-field px-3 py-2.5 text-[14px]">
            <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="accent-brand" />
            <span className="text-muted">{toTimeInput(new Date(r.scheduledAt))}</span>
            {categoryOf(r.category).emoji} {r.place?.name ?? r.title}
          </label>
        ))}
        {addedPlaces.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-xl border border-brand bg-brand-soft px-3 py-2.5 text-[14px]">
            <span className="text-[11px] font-semibold text-brand-strong">{t.albums.newVisit}</span>
            <span className="min-w-0 flex-1 truncate">
              {categoryOf(p.category).emoji} {p.name}
            </span>
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
        {addedPlaces.length > 0 && <p className="text-[11px] text-brand">{t.albums.newVisitHint}</p>}
      </div>

      <Field label={t.common.mustSee}>
        <input maxLength={300} value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder={t.albums.highlightPlaceholder} className={inputClass} />
      </Field>

      {footer}

      {error && <p className="text-[12px] text-coral-strong">{t.common.saveFailed}: {errorMessage(error, t)}</p>}

      <button
        type="submit"
        disabled={!canSave}
        className="h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none"
      >
        {isPending ? t.common.saving : submitLabel}
      </button>
    </form>
  )
}
