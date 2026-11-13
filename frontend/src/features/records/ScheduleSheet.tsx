import { Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import calendarDaysIcon from '../../assets/icons/calendar-days.svg'
import calendarIcon from '../../assets/icons/calendar.svg'
import clockOutlineIcon from '../../assets/icons/clock-outline.svg'
import clockIcon from '../../assets/icons/clock.svg'
import { BottomSheet } from '../../components/BottomSheet'
import { CategoryIcon } from '../../components/CategoryIcon'
import { PixelSprite } from '../../components/PixelSprite'
import { Chip, Field, inputClass } from '../../components/Field'
import { MemoInput, MemoText } from '../../components/Memo'
import { FORM_CATEGORY_ORDER } from '../../lib/categories'
import { errorMessage } from '../../lib/api'
import { fromInputs, toDateInput, toTimeInput } from '../../lib/dates'
import { decodeMemo, encodeMemo } from '../../lib/memo'
import { useCreateRecord, useDeleteRecord, usePlaces, useUpdateRecord } from '../../lib/queries'
import type { DateRecord, PlaceCategory, RecordType } from '../../lib/types'
import { NewPlaceFields } from './NewPlaceFields'
import type { PickedPlace } from '../../lib/places'
import { SavedPlacePicker } from './SavedPlacePicker'
import { useT } from '../../lib/i18n'
import { useIsRetro } from '../../lib/theme'

interface Props {
  /** Editing an existing record; without it the sheet creates a new one on `initialDate`. */
  record?: DateRecord
  initialDate?: Date
  onClose: () => void
  onSaved?: (scheduledAt: Date) => void
}

const TYPE_OPTIONS: { value: RecordType; key: 'plan' | 'record'; activeClass: string }[] = [
  { value: 'PLAN', key: 'plan', activeClass: 'text-coral' },
  { value: 'RECORD', key: 'record', activeClass: 'text-brand-strong' },
]

/** Where the record happens: one of the couple's saved places, or a new one from Google. */
type PlaceSource = 'saved' | 'new'

export function ScheduleSheet({ record, initialDate = new Date(), onClose, onSaved }: Props) {
  const t = useT()
  const retro = useIsRetro()
  const editing = record !== undefined
  const createRecord = useCreateRecord()
  const updateRecord = useUpdateRecord(record?.id ?? 0)
  const deleteRecord = useDeleteRecord()
  const { data: places = [] } = usePlaces()
  const at = record ? new Date(record.scheduledAt) : null

  const [type, setType] = useState<RecordType>(record?.type ?? 'PLAN')
  const [date, setDate] = useState(toDateInput(at ?? initialDate))
  const [time, setTime] = useState(at ? toTimeInput(at) : '18:00')
  // Until chosen: saved places when there are any (a record whose place was deleted starts as new).
  const [source, setSource] = useState<PlaceSource | null>(record ? (record.placeId ? 'saved' : 'new') : null)
  const [savedId, setSavedId] = useState<number | null>(record?.placeId ?? null)
  const [mapUrl, setMapUrl] = useState('')
  const [placeName, setPlaceName] = useState(record && !record.placeId ? record.title : '')
  const [picked, setPicked] = useState<PickedPlace | null>(null)
  const [category, setCategory] = useState<PlaceCategory>(record?.category ?? 'CAFE')
  // The date's own memo; the place memo is a new note added to the place, so it always starts empty.
  const [memo, setMemo] = useState(() => decodeMemo(record?.memo, t))
  const [placeMemo, setPlaceMemo] = useState('')
  const [rating, setRating] = useState(record?.rating ?? 5)

  const placeSource = source ?? (places.length > 0 ? 'saved' : 'new')
  const mutation = editing ? updateRecord : createRecord
  const busy = mutation.isPending || deleteRecord.isPending
  const hasPlace = placeSource === 'saved' ? savedId !== null : placeName.trim() !== ''
  const canSave = hasPlace && date !== '' && time !== '' && !busy
  const error = mutation.error ?? deleteRecord.error
  const latestPlaceNote = placeSource === 'saved' ? places.find((p) => p.id === savedId)?.latestNote : null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const scheduledAt = fromInputs(date, time)
    const done = {
      onSuccess: () => {
        onSaved?.(scheduledAt)
        onClose()
      },
    }
    const newPlace = {
      placeName: placeName.trim(),
      googleMapsUrl: mapUrl.trim() || picked?.googleMapsUrl,
      googlePlaceId: picked?.googlePlaceId,
      address: picked?.address,
      latitude: picked?.latitude,
      longitude: picked?.longitude,
    }
    const content = encodeMemo(memo)
    const placeNote = encodeMemo(placeMemo) || undefined

    if (editing) {
      updateRecord.mutate(
        {
          type,
          scheduledAt: scheduledAt.toISOString(),
          category,
          memo: content || null,
          placeNote,
          rating: type === 'RECORD' ? rating : null,
          // Only move the record to another place when the place actually changed.
          ...(placeSource === 'new' ? newPlace : savedId !== record.placeId && { placeId: savedId! }),
        },
        done,
      )
      return
    }
    createRecord.mutate(
      {
        type,
        scheduledAt: scheduledAt.toISOString(),
        category,
        ...(placeSource === 'saved' ? { placeId: savedId! } : newPlace),
        memo: content || undefined,
        placeNote,
        rating: type === 'RECORD' ? rating : undefined,
      },
      done,
    )
  }

  function remove() {
    if (record && window.confirm(t.schedule.confirmDelete)) deleteRecord.mutate(record.id, { onSuccess: onClose })
  }

  return (
    <BottomSheet title={editing ? t.schedule.titleEdit : t.schedule.titleNew} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="ui-seg flex h-11 gap-2 rounded-2xl bg-segment p-1" role="radiogroup" aria-label={t.schedule.kind}>
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={type === option.value}
              onClick={() => setType(option.value)}
              className={`ui-seg-option flex-1 rounded-xl text-[14px] leading-normal font-semibold retro:text-[13px] ${
                type === option.value ? `bg-white ${option.activeClass}` : 'text-ink'
              }`}
            >
              {t.schedule[option.key]}
            </button>
          ))}
        </div>

        <div className="flex gap-3 py-4">
          <Field label={t.common.date} className="flex-1">
            <PickerInput type="date" value={date} onChange={setDate} icon={editing ? calendarDaysIcon : calendarIcon} />
          </Field>
          <Field label={t.common.time} className="flex-1">
            <PickerInput type="time" value={time} onChange={setTime} icon={editing ? clockOutlineIcon : clockIcon} />
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] leading-normal font-semibold text-muted">{t.schedule.place}</span>
          <div className="ui-seg flex h-10 gap-2 rounded-xl bg-segment p-1" role="radiogroup" aria-label={t.schedule.place}>
            {(['saved', 'new'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={placeSource === value}
                onClick={() => setSource(value)}
                className={`ui-seg-option flex-1 rounded-lg text-[13px] leading-normal font-semibold retro:text-[12px] ${placeSource === value ? 'bg-white text-brand-strong' : 'text-ink'}`}
              >
                {t.schedule.placeSource[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3">
          {placeSource === 'saved' ? (
            <SavedPlacePicker
              places={places}
              selectedIds={savedId === null ? [] : [savedId]}
              onSelect={(place) => {
                setSavedId(place.id)
                setCategory(place.category)
              }}
            />
          ) : (
            <NewPlaceFields
              mapUrl={mapUrl}
              onMapUrlChange={setMapUrl}
              mapLinkLabel={t.schedule.mapLink}
              name={placeName}
              onNameChange={setPlaceName}
              picked={picked}
              onPick={(place) => {
                setPicked(place)
                if (place?.category) setCategory(place.category)
              }}
              editing={editing}
            />
          )}
        </div>

        {/* A saved place already has its category. */}
        {placeSource === 'new' && (
          <div className="flex flex-col gap-1.5 pt-4">
            <span className="text-[12px] leading-normal font-semibold text-muted">{t.common.placeCategory}</span>
            <div className="flex flex-wrap gap-2">
              {FORM_CATEGORY_ORDER.map((value) => {
                return (
                  <Chip key={value} selected={category === value} onClick={() => setCategory(value)}>
                    <CategoryIcon category={value} /> {t.categories[value]}
                  </Chip>
                )
              })}
            </div>
          </div>
        )}

        <div className="pt-4">
          {latestPlaceNote && (
            <div className="mb-2 flex flex-col gap-1 rounded-xl bg-amber-soft p-3 retro:mx-0.5 retro:pixel-outline retro:pixel-thin retro:[--pixel-border:var(--color-amber)]">
              <span className="text-[11px] leading-normal font-semibold text-amber-ink/70">{t.schedule.latestPlaceMemo}</span>
              <MemoText content={latestPlaceNote} className="text-[13px] leading-[1.75] whitespace-pre-line text-amber-ink" />
            </div>
          )}
          <MemoInput
            label={t.schedule.placeMemo}
            value={placeMemo}
            onChange={setPlaceMemo}
            placeholder={t.schedule.placeMemoPlaceholder}
            maxLength={500}
          />
          <p className="px-1 pt-1 text-[11px] leading-normal text-muted">{t.schedule.placeMemoHint}</p>
        </div>

        {type === 'RECORD' && (
          <div className="flex flex-col gap-1.5 pt-4">
            <span className="text-[12px] leading-normal font-semibold text-muted">{t.common.rating}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={t.common.rating}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={t.common.points(n)}
                  onClick={() => setRating(n)}
                  className={`ui-pop ${n <= rating ? 'text-amber' : 'text-chip-border'}`}
                >
                  {retro ? (
                    <PixelSprite name={n <= rating ? 'star' : 'starOff'} scale={3} />
                  ) : (
                    <Star size={26} strokeWidth={1.5} fill={n <= rating ? 'currentColor' : 'none'} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <MemoInput
          label={t.schedule.memo}
          value={memo}
          onChange={setMemo}
          placeholder={t.schedule.memoPlaceholder}
          maxLength={1000}
          className="pt-4"
        />

        {error && <p className="pt-3 text-[12px] text-coral-strong">{t.common.saveFailed}: {errorMessage(error, t)}</p>}

        {editing ? (
          <>
            <div className="flex gap-3 pt-5">
              <button type="button" onClick={onClose} className="ui-btn h-12 w-24 rounded-2xl bg-sand-soft text-[16px] font-semibold text-muted retro:mb-1.5 retro:bg-white retro:text-[14px]">
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="ui-btn h-12 flex-1 rounded-2xl bg-brand-strong text-[16px] font-semibold text-white shadow-[0_6px_14px_rgba(0,168,150,0.25)] disabled:opacity-50 retro:mb-1.5 retro:text-[14px]"
              >
                {updateRecord.isPending ? t.common.saving : t.common.saveChanges}
              </button>
            </div>
            <button type="button" onClick={remove} disabled={busy} className="mx-auto mt-4 block text-[12px] text-muted underline">
              {t.schedule.delete}
            </button>
          </>
        ) : (
          <div className="pt-5">
            <button
              type="submit"
              disabled={!canSave}
              className="ui-btn h-12 w-full rounded-2xl bg-brand-strong text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none retro:mb-1.5 retro:text-[14px]"
            >
              {createRecord.isPending ? t.common.saving : t.schedule.save}
            </button>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}

/** Native date/time input with the design's icon; tapping anywhere opens the picker. */
function PickerInput({
  type,
  value,
  onChange,
  icon,
}: {
  type: 'date' | 'time'
  value: string
  onChange: (value: string) => void
  icon: string
}) {
  return (
    <div className={`${inputClass} relative flex items-center justify-between focus-within:border-brand`}>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="w-full bg-transparent outline-none [&::-webkit-calendar-picker-indicator]:hidden"
      />
      <img src={icon} alt="" width={16} height={16} className="pointer-events-none shrink-0" />
    </div>
  )
}
