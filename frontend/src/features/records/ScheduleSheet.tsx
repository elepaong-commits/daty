import { useState, type FormEvent } from 'react'
import calendarIcon from '../../assets/icons/calendar.svg'
import clockIcon from '../../assets/icons/clock.svg'
import { BottomSheet } from '../../components/BottomSheet'
import { Chip, Field, inputClass } from '../../components/Field'
import { categoryOf, FORM_CATEGORY_ORDER } from '../../lib/categories'
import { fromInputs, toDateInput } from '../../lib/dates'
import { useCreateRecord } from '../../lib/queries'
import type { PlaceCategory, RecordType } from '../../lib/types'
import { PlaceSearch, type PickedPlace } from './PlaceSearch'

interface Props {
  initialDate: Date
  onClose: () => void
  onSaved?: (scheduledAt: Date) => void
}

const TYPE_OPTIONS: { value: RecordType; label: string; activeClass: string }[] = [
  { value: 'PLAN', label: '📌 예정된 데이트', activeClass: 'text-coral' },
  { value: 'RECORD', label: '📸 다녀온 기록', activeClass: 'text-brand' },
]

export function ScheduleSheet({ initialDate, onClose, onSaved }: Props) {
  const createRecord = useCreateRecord()
  const [type, setType] = useState<RecordType>('PLAN')
  const [date, setDate] = useState(toDateInput(initialDate))
  const [time, setTime] = useState('18:00')
  const [mapUrl, setMapUrl] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [picked, setPicked] = useState<PickedPlace | null>(null)
  const [category, setCategory] = useState<PlaceCategory>('CAFE')
  const [memo, setMemo] = useState('')
  const [rating, setRating] = useState(5)

  const canSave = placeName.trim() !== '' && date !== '' && time !== '' && !createRecord.isPending

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const scheduledAt = fromInputs(date, time)
    createRecord.mutate(
      {
        type,
        scheduledAt: scheduledAt.toISOString(),
        category,
        placeName: placeName.trim(),
        googleMapsUrl: mapUrl.trim() || picked?.googleMapsUrl,
        googlePlaceId: picked?.googlePlaceId,
        address: picked?.address,
        latitude: picked?.latitude,
        longitude: picked?.longitude,
        memo: memo.trim() || undefined,
        rating: type === 'RECORD' ? rating : undefined,
      },
      {
        onSuccess: () => {
          onSaved?.(scheduledAt)
          onClose()
        },
      },
    )
  }

  return (
    <BottomSheet title="데이트 일정 등록" onClose={onClose}>
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
            <PickerInput type="date" value={date} onChange={setDate} icon={calendarIcon} />
          </Field>
          <Field label="시간" className="flex-1">
            <PickerInput type="time" value={time} onChange={setTime} icon={clockIcon} />
          </Field>
        </div>

        <Field label="구글 지도 링크">
          <div className={`${inputClass} flex items-center gap-2.5 focus-within:border-brand`}>
            <span className="text-[16px]">📍</span>
            <input
              type="url"
              inputMode="url"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-placeholder"
            />
          </div>
        </Field>

        <Field label="장소 이름" className="pt-4">
          <PlaceSearch
            name={placeName}
            onNameChange={setPlaceName}
            picked={picked}
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

        {createRecord.error && (
          <p className="pt-3 text-[12px] text-coral-strong">저장하지 못했어요: {createRecord.error.message}</p>
        )}

        <div className="pt-5">
          <button
            type="submit"
            disabled={!canSave}
            className="h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none"
          >
            {createRecord.isPending ? '저장 중…' : '일정 저장'}
          </button>
        </div>
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
