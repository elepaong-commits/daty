import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import calendarDaysIcon from '../../assets/icons/calendar-days.svg'
import mapPinIcon from '../../assets/icons/map-pin.svg'
import { Field, inputClass, QueryState } from '../../components/Field'
import { HeaderAction, SubHeader } from '../../components/SubHeader'
import { errorMessage } from '../../lib/api'
import { categoryOf, FORM_CATEGORY_ORDER } from '../../lib/categories'
import { fromInputs, toDateInput, toTimeInput } from '../../lib/dates'
import { usePlace, useUpdatePlace } from '../../lib/queries'
import type { PlaceCategory, PlaceDetail, PlaceStatus, TipType } from '../../lib/types'

// What the memo is about when the place has no tip type yet.
const DEFAULT_TIP: Record<PlaceCategory, TipType> = {
  FOOD: 'EAT',
  CAFE: 'EAT',
  BAR: 'EAT',
  EXHIBIT: 'SEE',
  TOUR: 'SEE',
  ACTIVITY: 'DO',
}
const MEMO_LABEL: Record<TipType, string> = { EAT: '꼭 먹어야 할 것', SEE: '꼭 봐야 할 것', DO: '꼭 해 볼 것' }

export function PlaceEditPage() {
  const id = Number(useParams().id)
  const { data: place, isLoading, error } = usePlace(id)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {place ? (
        // Keyed so the form starts from the loaded values.
        <PlaceEditForm key={place.id} place={place} />
      ) : (
        <>
          <SubHeader eyebrow="데이트 지도 · 장소 기록" title="장소 정보 수정" fallback={`/places/${id}`} />
          <QueryState isLoading={isLoading} error={error} />
        </>
      )}
    </div>
  )
}

function PlaceEditForm({ place }: { place: PlaceDetail }) {
  const navigate = useNavigate()
  const updatePlace = useUpdatePlace(place.id)
  const visit = place.latestVisit
  const [status, setStatus] = useState<PlaceStatus>(place.status)
  const [name, setName] = useState(place.name)
  const [category, setCategory] = useState(place.category)
  const [address, setAddress] = useState(place.address ?? '')
  const [visitDate, setVisitDate] = useState(visit ? toDateInput(new Date(visit.scheduledAt)) : '')
  const [rating, setRating] = useState<number | null>(visit?.rating ?? null)
  const [memo, setMemo] = useState(place.tipText ?? '')

  const tipType = place.tipType ?? DEFAULT_TIP[category]
  const visited = status === 'VISITED'
  const canSave = name.trim() !== '' && !updatePlace.isPending
  const close = () => navigate(`/places/${place.id}`, { replace: true })

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
        tipText: memo.trim() || null,
        tipType: memo.trim() ? tipType : null,
        visit: visitChanged ? { scheduledAt: fromInputs(visitDate, time).toISOString(), rating } : undefined,
      },
      { onSuccess: close },
    )
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SubHeader
        eyebrow="데이트 지도 · 장소 기록"
        title="장소 정보 수정"
        fallback={`/places/${place.id}`}
        action={<HeaderAction onClick={close}>취소</HeaderAction>}
      />

      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-4">
          <div className="flex h-11 gap-2 rounded-2xl bg-sand-soft p-1" role="radiogroup" aria-label="방문 상태">
            {(['VISITED', 'WISH'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={status === value}
                onClick={() => setStatus(value)}
                className={`flex-1 rounded-xl text-[13px] font-semibold ${status === value ? 'bg-brand text-white' : 'text-ink'}`}
              >
                {value === 'VISITED' ? '✓ 갔던 곳' : '♡ 가고 싶은 곳'}
              </button>
            ))}
          </div>

          <Field label="장소 이름">
            <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-muted">장소 구분</span>
            <div className="flex flex-wrap gap-2">
              {FORM_CATEGORY_ORDER.map((value) => {
                const c = categoryOf(value)
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={category === value}
                    onClick={() => setCategory(value)}
                    className={`h-[34px] rounded-full border px-3 text-[12px] font-semibold ${
                      category === value ? 'border-brand bg-brand text-white' : 'border-field-border bg-white'
                    }`}
                  >
                    {c.emoji} {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Field label="지역" className="min-w-0 flex-1">
              <div className={`${inputClass} flex items-center gap-2 focus-within:border-brand`}>
                <input
                  maxLength={200}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="예) 성수동"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-placeholder"
                />
                <img src={mapPinIcon} alt="" width={16} height={16} />
              </div>
            </Field>
            {visited && (
              <Field label="방문 날짜" className="min-w-0 flex-1">
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
              <span className="text-[12px] font-semibold text-muted">우리의 평점</span>
              <div className="flex h-12 items-center gap-3 rounded-xl border border-field-border bg-field px-3">
                <div className="flex flex-1" role="radiogroup" aria-label="평점">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n}점`}
                      onClick={() => setRating(n)}
                      className={`text-[23px] leading-none ${rating !== null && n <= rating ? 'text-[#eaa300]' : 'text-chip-border'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span className="text-[18px] font-semibold">{rating !== null ? rating.toFixed(1) : '-'}</span>
                <span className="text-[12px] text-muted">/ 5</span>
              </div>
            </div>
          )}

          <Field label={`메모 · ${MEMO_LABEL[tipType]}`}>
            <textarea
              rows={3}
              maxLength={200}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className={`${inputClass} h-[78px] resize-none py-2.5 leading-normal`}
            />
          </Field>
        </div>

        {place.albums[0] && (
          <p className="px-1 text-[11px] leading-normal text-muted">📷 연결된 ‘{place.albums[0].title}’ 앨범은 그대로 유지돼요.</p>
        )}
        {updatePlace.error && <p className="px-1 text-[12px] text-coral-strong">{errorMessage(updatePlace.error)}</p>}

        <div className="mt-auto flex gap-3 pt-[18px] pb-5">
          <button type="button" onClick={close} className="h-12 w-24 rounded-2xl bg-sand-soft text-[16px] font-semibold text-muted">
            취소
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="h-12 flex-1 rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-[0_6px_14px_rgba(0,168,150,0.25)] disabled:opacity-50"
          >
            {updatePlace.isPending ? '저장 중…' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </form>
  )
}
