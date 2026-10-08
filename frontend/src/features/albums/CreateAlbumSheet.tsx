import { useState, type FormEvent } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { Field, inputClass } from '../../components/Field'
import { categoryOf } from '../../lib/categories'
import { parseDateOnly, toDateInput, toTimeInput } from '../../lib/dates'
import { useCreateAlbum, useMonthRecords } from '../../lib/queries'

export function CreateAlbumSheet({ onClose }: { onClose: () => void }) {
  const createAlbum = useCreateAlbum()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(toDateInput(new Date()))
  const [highlight, setHighlight] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())

  // Offer the visits on the chosen day so the album shows where it was taken.
  const { data: monthRecords = [] } = useMonthRecords(parseDateOnly(date || toDateInput(new Date())))
  const dayRecords = monthRecords.filter(
    (r) => r.type === 'RECORD' && r.albumId === null && toDateInput(new Date(r.scheduledAt)) === date,
  )

  const canSave = title.trim() !== '' && date !== '' && !createAlbum.isPending

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    createAlbum.mutate(
      {
        title: title.trim(),
        albumDate: date,
        highlightNote: highlight.trim() || undefined,
        recordIds: [...picked].filter((id) => dayRecords.some((r) => r.id === id)),
      },
      { onSuccess: onClose },
    )
  }

  return (
    <BottomSheet title="새 앨범" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="앨범 이름">
          <input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 성수동 카페 데이트" className={inputClass} />
        </Field>
        <Field label="날짜">
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

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] leading-normal font-semibold text-muted">이날 다녀온 곳</span>
          {dayRecords.length === 0 ? (
            <p className="text-[12px] text-muted">이 날짜에 아직 앨범에 묶이지 않은 기록이 없어요</p>
          ) : (
            dayRecords.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded-xl border border-field-border bg-field px-3 py-2.5 text-[14px]">
                <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="accent-brand" />
                <span className="text-muted">{toTimeInput(new Date(r.scheduledAt))}</span>
                {categoryOf(r.category).emoji} {r.place?.name ?? r.title}
              </label>
            ))
          )}
        </div>

        <Field label="꼭 봐야 할 포인트">
          <input maxLength={300} value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder="예) 2층 창가에서 찍은 노을 사진" className={inputClass} />
        </Field>

        <p className="rounded-xl bg-sand-soft px-3 py-2 text-[12px] text-muted">📷 사진 올리기는 곧 추가돼요</p>

        {createAlbum.error && <p className="text-[12px] text-coral-strong">저장하지 못했어요: {createAlbum.error.message}</p>}

        <button
          type="submit"
          disabled={!canSave}
          className="h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none"
        >
          {createAlbum.isPending ? '저장 중…' : '앨범 만들기'}
        </button>
      </form>
    </BottomSheet>
  )
}
