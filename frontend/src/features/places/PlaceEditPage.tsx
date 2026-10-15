import { Check, Heart, Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import calendarDaysIcon from '../../assets/icons/calendar-days.svg'
import mapPinIcon from '../../assets/icons/map-pin.svg'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Field, inputClass, QueryState } from '../../components/Field'
import { PixelSprite } from '../../components/PixelSprite'
import { HeaderAction, SubHeader } from '../../components/SubHeader'
import { errorMessage } from '../../lib/api'
import { FORM_CATEGORY_ORDER } from '../../lib/categories'
import { fromInputs, toDateInput, toTimeInput } from '../../lib/dates'
import { useDeletePlace, usePlace, useUpdatePlace } from '../../lib/queries'
import type { PlaceDetail, PlaceStatus } from '../../lib/types'
import { useT } from '../../lib/i18n'
import { useIsRetro } from '../../lib/theme'
import type { MapFocus } from '../map/MapPage'

export function PlaceEditPage() {
  const id = Number(useParams().id)
  const t = useT()
  const { data: place, isLoading, error } = usePlace(id)

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[640px]">
      {place ? (
        // Keyed so the form starts from the loaded values.
        <PlaceEditForm key={place.id} place={place} />
      ) : (
        <>
          <SubHeader eyebrow={t.place.editEyebrow} title={t.place.editPlace} fallback={`/places/${id}`} />
          <QueryState isLoading={isLoading} error={error} />
        </>
      )}
    </div>
  )
}

function PlaceEditForm({ place }: { place: PlaceDetail }) {
  const t = useT()
  const retro = useIsRetro()
  const navigate = useNavigate()
  const updatePlace = useUpdatePlace(place.id)
  const deletePlace = useDeletePlace(place.id)
  const visit = place.latestVisit
  const [status, setStatus] = useState<PlaceStatus>(place.status)
  const [name, setName] = useState(place.name)
  const [category, setCategory] = useState(place.category)
  const [address, setAddress] = useState(place.address ?? '')
  const [visitDate, setVisitDate] = useState(visit ? toDateInput(new Date(visit.scheduledAt)) : '')
  const [rating, setRating] = useState<number | null>(visit?.rating ?? null)
  const visited = status === 'VISITED'
  const busy = updatePlace.isPending || deletePlace.isPending
  const canSave = name.trim() !== '' && !busy
  const error = updatePlace.error ?? deletePlace.error
  const close = () => navigate(`/places/${place.id}`, { replace: true })
  // Saved: back to the map, on the place's (possibly new) tab with its card selected.
  const toMap = (saved: { id: number; status: PlaceStatus }) =>
    navigate('/', { replace: true, state: { placeId: saved.id, status: saved.status } satisfies MapFocus })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    // Visit date/rating belong to the latest visit; keep its time of day, or noon for a first visit.
    const visitChanged =
      visited && visitDate !== '' && (visitDate !== (visit && toDateInput(new Date(visit.scheduledAt))) || rating !== (visit?.rating ?? null))
    const time = visit ? toTimeInput(new Date(visit.scheduledAt)) : '12:00'
    updatePlace.mutate(
      {
        name: name.trim(),
        category,
        status,
        address: address.trim() || null,
        visit: visitChanged ? { scheduledAt: fromInputs(visitDate, time).toISOString(), rating } : undefined,
      },
      { onSuccess: toMap },
    )
  }

  function remove() {
    if (window.confirm(t.place.confirmDelete)) deletePlace.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SubHeader
        eyebrow={t.place.editEyebrow}
        title={t.place.editPlace}
        fallback={`/places/${place.id}`}
        action={<HeaderAction onClick={close}>{t.common.cancel}</HeaderAction>}
      />

      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 retro:pt-1">
        <div className="ui-box-thin flex flex-col gap-4 rounded-3xl bg-white p-4">
          <div className="ui-seg flex h-11 gap-2 rounded-2xl bg-sand-soft p-1" role="radiogroup" aria-label={t.place.visitStatus}>
            {(['VISITED', 'WISH'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={status === value}
                onClick={() => setStatus(value)}
                className={`ui-seg-option flex flex-1 items-center justify-center gap-1 rounded-xl text-[13px] font-semibold retro:text-[12px] ${status === value ? 'bg-brand text-white' : 'text-ink'}`}
              >
                {!retro && (value === 'VISITED' ? <Check size={14} strokeWidth={1.75} /> : <Heart size={14} strokeWidth={1.75} />)} {t.status[value]}
              </button>
            ))}
          </div>

          <Field label={t.common.placeName}>
            <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-muted">{t.common.placeCategory}</span>
            <div className="flex flex-wrap gap-2">
              {FORM_CATEGORY_ORDER.map((value) => {
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={category === value}
                    onClick={() => setCategory(value)}
                    className={`ui-pop flex h-[34px] items-center gap-1 rounded-full border px-3 text-[12px] font-semibold retro:h-8 retro:border-0 retro:font-normal retro:pixel-outline retro:pixel-thin ${
                      category === value
                        ? 'border-brand bg-brand text-white retro:bg-brand-soft retro:text-brand-strong retro:[--pixel-border:var(--color-brand)]'
                        : 'border-field-border bg-white retro:[--pixel-border:var(--color-handle)]'
                    }`}
                  >
                    <CategoryIcon category={value} /> {t.categories[value]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Field label={t.place.area} className="min-w-0 flex-1">
              <div className={`${inputClass} flex items-center gap-2 focus-within:border-brand`}>
                <input
                  maxLength={200}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t.place.areaPlaceholder}
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-placeholder"
                />
                <img src={mapPinIcon} alt="" width={16} height={16} />
              </div>
            </Field>
            {visited && (
              <Field label={t.place.visitDate} className="min-w-0 flex-1">
                <div className={`${inputClass} flex items-center gap-2 focus-within:border-brand`}>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className="min-w-0 flex-1 bg-transparent outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <img src={calendarDaysIcon} alt="" width={16} height={16} className="pointer-events-none" />
                </div>
              </Field>
            )}
          </div>

          {visited && (
            <div className="flex flex-col gap-[5px]">
              <span className="text-[12px] font-semibold text-muted">{t.common.ourRating}</span>
              <div className="flex h-12 items-center gap-3 rounded-xl border border-field-border bg-field px-3 retro:border-0 retro:bg-white retro:pixel-field">
                <div className="flex flex-1" role="radiogroup" aria-label={t.common.rating}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={t.common.points(n)}
                      onClick={() => setRating(n)}
                      className={`ui-pop ${rating !== null && n <= rating ? 'text-[#eaa300]' : 'text-chip-border'}`}
                    >
                      {retro ? (
                        <PixelSprite name={rating !== null && n <= rating ? 'star' : 'starOff'} scale={3} className="mr-1" />
                      ) : (
                        <Star size={23} strokeWidth={1.5} fill={rating !== null && n <= rating ? 'currentColor' : 'none'} />
                      )}
                    </button>
                  ))}
                </div>
                <span className="text-[18px] font-semibold">{rating !== null ? rating.toFixed(1) : '-'}</span>
                <span className="text-[12px] text-muted">/ 5</span>
              </div>
            </div>
          )}
        </div>

        <p className="px-1 text-[11px] leading-normal text-muted">{t.place.notesOnDetail}</p>
        {place.albums[0] && (
          <p className="px-1 text-[11px] leading-normal text-muted">{t.place.albumKept(place.albums[0].title)}</p>
        )}
        {error && <p className="px-1 text-[12px] text-coral-strong">{errorMessage(error, t)}</p>}

        <div className="mt-auto pt-[18px] pb-5">
          <div className="flex gap-3">
            <button type="button" onClick={close} className="ui-btn h-12 w-24 rounded-2xl bg-sand-soft text-[16px] font-semibold text-muted retro:mb-1.5 retro:bg-white retro:text-[14px]">
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="ui-btn h-12 flex-1 rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-[0_6px_14px_rgba(0,168,150,0.25)] disabled:opacity-50 retro:mb-1.5 retro:text-[14px]"
            >
              {updatePlace.isPending ? t.common.saving : t.common.saveChanges}
            </button>
          </div>
          <button type="button" onClick={remove} disabled={busy} className="mx-auto mt-4 block text-[12px] text-muted underline">
            {t.place.delete}
          </button>
        </div>
      </div>
    </form>
  )
}
