import { useState, type FormEvent } from 'react'
import calendarDaysIcon from '../../assets/icons/calendar-days.svg'
import calendarIcon from '../../assets/icons/calendar.svg'
import clockOutlineIcon from '../../assets/icons/clock-outline.svg'
import clockIcon from '../../assets/icons/clock.svg'
import mapPinIcon from '../../assets/icons/map-pin.svg'
import { BottomSheet } from '../../components/BottomSheet'
import { Chip, Field, inputClass } from '../../components/Field'
import { categoryOf, FORM_CATEGORY_ORDER } from '../../lib/categories'
import { errorMessage } from '../../lib/api'
import { fromInputs, toDateInput, toTimeInput } from '../../lib/dates'
import { useCreateRecord, useDeleteRecord, useUpdateRecord } from '../../lib/queries'
import type { DateRecord, PlaceCategory, RecordType } from '../../lib/types'
import { PlaceSearch, type PickedPlace } from './PlaceSearch'

interface Props {
  /** Editing an existing record; without it the sheet creates a new one on `initialDate`. */
  record?: DateRecord
  initialDate?: Date
  onClose: () => void
  onSaved?: (scheduledAt: Date) => void
}

const TYPE_OPTIONS: { value: RecordType; label: string; activeClass: string }[] = [
  { value: 'PLAN', label: '📌 예정된 데이트', activeClass: 'text-coral' },
  { value: 'RECORD', label: '📸 다녀온 기록', activeClass: 'text-brand' },
]

export function ScheduleSheet({ record, initialDate = new Date(), onClose, onSaved }: Props) {
  const editing = record !== undefined
  const createRecord = useCreateRecord()
  const updateRecord = useUpdateRecord(record?.id ?? 0)
  const deleteRecord = useDeleteRecord()
  const at = record ? new Date(record.scheduledAt) : null
  const originalName = record?.place?.name ?? record?.title ?? ''
  const originalMapUrl = record?.place?.googleMapsUrl ?? ''

  const [type, setType] = useState<RecordType>(record?.type ?? 'PLAN')
  const [date, setDate] = useState(toDateInput(at ?? initialDate))
  const [time, setTime] = useState(at ? toTimeInput(at) : '18:00')
  const [mapUrl, setMapUrl] = useState(originalMapUrl)
  const [placeName, setPlaceName] = useState(originalName)
  const [picked, setPicked] = useState<PickedPlace | null>(null)
  const [category, setCategory] = useState<PlaceCategory>(record?.category ?? 'CAFE')
  const [memo, setMemo] = useState(record?.memo ?? '')
  const [rating, setRating] = useState(record?.rating ?? 5)

  const mutation = editing ? updateRecord : createRecord
  const busy = mutation.isPending || deleteRecord.isPending
  const canSave = placeName.trim() !== '' && date !== '' && time !== '' && !busy
  const error = mutation.error ?? deleteRecord.error

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
    const location = {
      googlePlaceId: picked?.googlePlaceId,
      address: picked?.address,
      latitude: picked?.latitude,
      longitude: picked?.longitude,
    }

    if (editing) {
      const nameChanged = placeName.trim() !== originalName
      updateRecord.mutate(
        {
          type,
          scheduledAt: scheduledAt.toISOString(),
          category,
          memo: memo.trim() || null,
          rating: type === 'RECORD' ? rating : null,
          // Only move the record to another place when the place actually changed.
          ...((picked || nameChanged) && { placeName: placeName.trim(), ...location }),
          googleMapsUrl: mapUrl.trim() && mapUrl.trim() !== originalMapUrl ? mapUrl.trim() : picked?.googleMapsUrl,
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
        placeName: placeName.trim(),
        googleMapsUrl: mapUrl.trim() || picked?.googleMapsUrl,
        ...location,
        memo: memo.trim() || undefined,
        rating: type === 'RECORD' ? rating : undefined,
      },
      done,
    )
  }

  function remove() {
    if (record && window.confirm('이 일정을 삭제할까요?')) deleteRecord.mutate(record.id, { onSuccess: onClose })
  }

  return (
    <BottomSheet title={editing ? '데이트 일정 수정' : '데이트 일정 등록'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="flex h-11 gap-2 rounded-2xl bg-segment p-1" role="radiogroup" aria-label="일정 종류">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={type === option.value}
              onClick={() => setType(option.value)}
              className={`flex-1 rounded-xl text-[14px] leading-normal font-semibold ${
                type === option.value ? `bg-white ${option.activeClass}` : 'text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 py-4">
          <Field label="날짜" className="flex-1">
            <PickerInput type="date" value={date} onChange={setDate} icon={editing ? calendarDaysIcon : calendarIcon} />
          </Field>
          <Field label="시간" className="flex-1">
            <PickerInput type="time" value={time} onChange={setTime} icon={editing ? clockOutlineIcon : clockIcon} />
          </Field>
        </div>

        <Field label="구글 지도 링크">
          <div className={`${inputClass} flex items-center gap-2.5 focus-within:border-brand`}>
            {!editing && <span className="text-[16px]">📍</span>}
            <input
              type="url"
              inputMode="url"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-placeholder"
            />
            {editing &&
              (mapUrl.trim() ? (
                <a href={mapUrl.trim()} target="_blank" rel="noreferrer" aria-label="지도에서 열기">
                  <img src={mapPinIcon} alt="" width={16} height={16} />
                </a>
              ) : (
                <img src={mapPinIcon} alt="" width={16} height={16} />
              ))}
          </div>
        </Field>
        {editing && <p className="pt-1.5 text-[11px] text-brand">💡 구글 지도 링크로 장소를 함께 확인해요.</p>}

        <Field label="장소 이름" className="pt-4">
          <PlaceSearch
            name={placeName}
            onNameChange={setPlaceName}
            picked={picked}
            currentName={editing ? originalName : undefined}
            onPick={(place) => {
              setPicked(place)
              if (place?.category) setCategory(place.category)
            }}
          />
        </Field>

        <div className="flex flex-col gap-1.5 pt-4">
          <span className="text-[12px] leading-normal font-semibold text-muted">장소 구분</span>
          <div className="flex flex-wrap gap-2">
            {FORM_CATEGORY_ORDER.map((value) => {
              const c = categoryOf(value)
              return (
                <Chip key={value} selected={category === value} onClick={() => setCategory(value)}>
                  {c.emoji} {c.label}
                </Chip>
              )
            })}
          </div>
        </div>

        {type === 'RECORD' && (
          <div className="flex flex-col gap-1.5 pt-4">
            <span className="text-[12px] leading-normal font-semibold text-muted">별점</span>
            <div className="flex gap-1" role="radiogroup" aria-label="별점">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n}점`}
                  onClick={() => setRating(n)}
                  className={`text-[26px] leading-none ${n <= rating ? 'text-amber' : 'text-chip-border'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="메모 · 꼭 해야 할 것" className="pt-4">
          <textarea
            rows={3}
            maxLength={1000}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예) 이건 꼭 먹어야 해! 시그니처 몽블랑"
            className={`${inputClass} h-[85px] resize-none py-2.5 leading-normal`}
          />
        </Field>

        {error && <p className="pt-3 text-[12px] text-coral-strong">저장하지 못했어요: {errorMessage(error)}</p>}

        {editing ? (
          <>
            <div className="flex gap-3 pt-5">
              <button type="button" onClick={onClose} className="h-12 w-24 rounded-2xl bg-sand-soft text-[16px] font-semibold text-muted">
                취소
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="h-12 flex-1 rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-[0_6px_14px_rgba(0,168,150,0.25)] disabled:opacity-50"
              >
                {updateRecord.isPending ? '저장 중…' : '변경사항 저장'}
              </button>
            </div>
            <button type="button" onClick={remove} disabled={busy} className="mx-auto mt-4 block text-[12px] text-muted underline">
              이 일정 삭제
            </button>
          </>
        ) : (
          <div className="pt-5">
            <button
              type="submit"
              disabled={!canSave}
              className="h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none"
            >
              {createRecord.isPending ? '저장 중…' : '일정 저장'}
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
