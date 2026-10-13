import { useMemo, useState } from 'react'
import chevronLeft from '../../assets/icons/chevron-left.svg'
import chevronRight from '../../assets/icons/chevron-right.svg'
import markerPlan from '../../assets/icons/marker-plan.svg'
import markerRecord from '../../assets/icons/marker-record.svg'
import { QueryState } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { addMonths, isSameDay, monthGrid, startOfDay, startOfMonth, toDateInput } from '../../lib/dates'
import { useMonthRecords } from '../../lib/queries'
import type { DateRecord } from '../../lib/types'
import { ScheduleSheet } from '../records/ScheduleSheet'
import { DayTimeline } from './DayTimeline'

const WEEKDAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_BARS = 2

export function CalendarPage() {
  const today = startOfDay(new Date())
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(today)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<DateRecord | null>(null)
  const { data: records = [], isLoading, error } = useMonthRecords(month)

  const byDay = useMemo(() => {
    const map = new Map<string, DateRecord[]>()
    for (const r of records) {
      const key = toDateInput(new Date(r.scheduledAt))
      map.set(key, [...(map.get(key) ?? []), r])
    }
    return map
  }, [records])

  const recordCount = records.filter((r) => r.type === 'RECORD').length
  const planCount = records.length - recordCount
  const weeks = monthGrid(month)

  function goToMonth(next: Date) {
    setMonth(startOfMonth(next))
    setSelected(isSameDay(startOfMonth(next), startOfMonth(today)) ? today : startOfMonth(next))
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto pb-28">
        <ScreenHeader
          eyebrow="우리 둘의 캘린더"
          title={`${month.getFullYear()}년 ${month.getMonth() + 1}월`}
          actions={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => goToMonth(today)} className="h-9 rounded-full bg-white px-3 text-[12px] font-semibold">
                오늘
              </button>
              <button type="button" onClick={() => goToMonth(addMonths(month, -1))} className="flex size-9 items-center justify-center rounded-full bg-white" aria-label="이전 달">
                <img src={chevronLeft} alt="" width={16} height={16} />
              </button>
              <button type="button" onClick={() => goToMonth(addMonths(month, 1))} className="flex size-9 items-center justify-center rounded-full bg-white" aria-label="다음 달">
                <img src={chevronRight} alt="" width={16} height={16} />
              </button>
            </div>
          }
        />

        <section className="mx-4 rounded-3xl bg-white p-3 shadow-card">
          <div className="flex items-center gap-4 px-1 pb-3 text-[11px] leading-normal">
            <span className="flex items-center gap-1.5 font-semibold">
              <img src={markerRecord} alt="" width={8} height={8} /> 데이트 기록
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              <img src={markerPlan} alt="" width={8} height={8} /> 예정된 데이트
            </span>
            <span className="flex-1 text-right font-medium text-muted">
              기록 {recordCount} · 예정 {planCount}
            </span>
          </div>

          <div className="grid grid-cols-7 pb-1 text-center text-[11px] leading-normal font-semibold">
            {WEEKDAY_HEADERS.map((d, i) => (
              <span key={d} className={i === 0 ? 'text-coral' : i === 6 ? 'text-brand' : ''}>
                {d}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {weeks.map((week) => (
              <div key={week[0]!.toISOString()} className="grid min-h-[60px] grid-cols-7">
                {week.map((day) => (
                  <DayCell
                    key={day.toISOString()}
                    day={day}
                    inMonth={day.getMonth() === month.getMonth()}
                    isToday={isSameDay(day, today)}
                    isSelected={isSameDay(day, selected)}
                    records={byDay.get(toDateInput(day)) ?? []}
                    onSelect={() => setSelected(day)}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <div className="px-5 pt-6">
          {isLoading || error ? (
            <QueryState isLoading={isLoading} error={error} />
          ) : (
            <DayTimeline day={selected} today={today} records={byDay.get(toDateInput(selected)) ?? []} onEdit={setEditing} />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="absolute right-5 bottom-5 flex h-14 items-center gap-2 rounded-full bg-brand pr-6 pl-5 text-white shadow-cta"
      >
        <span className="text-[24px] leading-none">+</span>
        <span className="text-[16px] font-semibold">일정 추가</span>
      </button>

      {editing && (
        <ScheduleSheet
          key={editing.id}
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={(at) => {
            setMonth(startOfMonth(at))
            setSelected(startOfDay(at))
          }}
        />
      )}

      {sheetOpen && (
        <ScheduleSheet
          initialDate={selected}
          onClose={() => setSheetOpen(false)}
          onSaved={(at) => {
            setMonth(startOfMonth(at))
            setSelected(startOfDay(at))
          }}
        />
      )}
    </div>
  )
}

function DayCell({
  day,
  inMonth,
  isToday,
  isSelected,
  records,
  onSelect,
}: {
  day: Date
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  records: DateRecord[]
  onSelect: () => void
}) {
  const weekday = day.getDay()
  const numberColor = !inMonth
    ? 'text-[rgba(203,213,224,0.6)]'
    : isSelected
      ? 'text-white'
      : weekday === 0
        ? 'text-coral'
        : weekday === 6
          ? 'text-brand'
          : 'text-ink'
  const visible = inMonth ? records.slice(0, MAX_BARS) : []
  const hidden = inMonth ? records.length - visible.length : 0

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!inMonth}
      aria-pressed={isSelected}
      aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일${records.length ? `, 일정 ${records.length}개` : ''}`}
      className={`flex min-w-0 flex-col items-stretch gap-0.5 rounded-xl px-0.5 pt-1 pb-1 ${isSelected ? 'bg-brand-soft' : ''}`}
    >
      <span
        className={`mx-auto flex size-7 items-center justify-center rounded-full text-[13px] leading-normal font-semibold ${numberColor} ${
          isSelected ? 'bg-brand' : isToday ? 'ring-1 ring-brand' : ''
        }`}
      >
        {day.getDate()}
      </span>
      {visible.map((r) => (
        <span
          key={r.id}
          className={`h-3.5 truncate rounded px-1 text-left text-[9px] leading-[1.556] font-semibold ${
            r.type === 'RECORD'
              ? 'border border-transparent bg-brand-soft text-brand-strong'
              : 'border border-coral/45 bg-coral-soft text-coral-strong'
          }`}
        >
          {r.place?.name ?? r.title}
        </span>
      ))}
      {hidden > 0 && <span className="text-left text-[9px] leading-normal font-semibold text-muted">+{hidden}</span>}
    </button>
  )
}
