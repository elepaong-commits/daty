import { AnimatePresence } from 'motion/react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import chevronLeft from '../../assets/icons/chevron-left.svg'
import chevronRight from '../../assets/icons/chevron-right.svg'
import markerPlan from '../../assets/icons/marker-plan.svg'
import markerRecord from '../../assets/icons/marker-record.svg'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PixelSprite } from '../../components/PixelSprite'
import { QueryState } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { errorMessage } from '../../lib/api'
import { addMonths, isSameDay, monthGrid, parseDateOnly, startOfDay, startOfMonth, toDateInput } from '../../lib/dates'
import { useAddRecordToAlbum, useAlbums, useMonthRecords } from '../../lib/queries'
import type { DateRecord } from '../../lib/types'
import type { NewAlbumDraft } from '../albums/CreateAlbumSheet'
import { ScheduleSheet } from '../records/ScheduleSheet'
import { DayTimeline } from './DayTimeline'
import { useT } from '../../lib/i18n'
import { useIsDesktop } from '../../lib/useIsDesktop'
import { useIsRetro } from '../../lib/theme'

const MAX_BARS = 2
const MAX_BARS_DESKTOP = 3

export function CalendarPage() {
  const t = useT()
  const retro = useIsRetro()
  const today = startOfDay(new Date())
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(today)
  // A schedule added from the desktop sidebar lands here with its date (YYYY-MM-DD) in router state.
  const focusDate = (useLocation().state as { focusDate?: string } | null)?.focusDate
  const [shownFocus, setShownFocus] = useState<string>()
  if (focusDate && focusDate !== shownFocus) {
    const day = parseDateOnly(focusDate)
    setShownFocus(focusDate)
    setMonth(startOfMonth(day))
    setSelected(day)
  }
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<DateRecord | null>(null)
  const [completed, setCompleted] = useState<DateRecord | null>(null)
  const navigate = useNavigate()
  const { data: albums = [] } = useAlbums()
  const addToAlbum = useAddRecordToAlbum()
  // A day keeps one album: a finished date joins the album its day already has.
  const completedDay = completed && toDateInput(new Date(completed.scheduledAt))
  const dayAlbum = completedDay ? albums.find((a) => a.albumDate <= completedDay && completedDay <= a.albumEndDate) : undefined
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

  function openAlbumFor(record: DateRecord) {
    if (dayAlbum) {
      addToAlbum.mutate({ album: dayAlbum, recordId: record.id }, { onSuccess: () => navigate(`/albums/${dayAlbum.id}`) })
      return
    }
    const draft: NewAlbumDraft = {
      title: record.place?.name ?? record.title,
      albumDate: toDateInput(new Date(record.scheduledAt)),
      recordId: record.id,
    }
    navigate('/albums', { state: { newAlbum: draft } })
  }

  function goToMonth(next: Date) {
    setMonth(startOfMonth(next))
    setSelected(isSameDay(startOfMonth(next), startOfMonth(today)) ? today : startOfMonth(next))
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto pb-28 lg:pb-10">
        <div className="lg:mx-auto lg:max-w-[1240px] lg:px-5">
        <ScreenHeader
          eyebrow={t.calendar.eyebrow}
          title={t.dates.yearMonth(month)}
          actions={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => goToMonth(today)} className="ui-btn-thin h-9 rounded-full bg-white px-3 text-[12px] font-semibold retro:mr-1.5 retro:font-normal">
                {t.calendar.today}
              </button>
              <button type="button" onClick={() => goToMonth(addMonths(month, -1))} className="ui-icon-button size-9 bg-white retro:mr-1.5" aria-label={t.calendar.prevMonth}>
                {retro ? <PixelSprite name="left" scale={2} /> : <img src={chevronLeft} alt="" width={16} height={16} />}
              </button>
              <button type="button" onClick={() => goToMonth(addMonths(month, 1))} className="ui-icon-button size-9 bg-white" aria-label={t.calendar.nextMonth}>
                {retro ? <PixelSprite name="right" scale={2} /> : <img src={chevronRight} alt="" width={16} height={16} />}
              </button>
            </div>
          }
        />

        {/* The day panel sits beside the month from xl; below it on narrower desktops so the cells keep their width. */}
        <div className="lg:px-5 xl:flex xl:items-start xl:gap-6">
        <section className="ui-box mx-4 rounded-3xl bg-white p-3 shadow-card lg:mx-0 lg:min-w-0 lg:flex-1 lg:p-5">
          <div className="flex items-center gap-4 px-1 pb-3 text-[11px] leading-normal">
            <span className="flex items-center gap-1.5 font-semibold">
              {retro ? <span className="size-2 bg-brand" /> : <img src={markerRecord} alt="" width={8} height={8} />} {t.calendar.legendRecord}
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              {retro ? <span className="size-2 border-2 border-coral" /> : <img src={markerPlan} alt="" width={8} height={8} />} {t.calendar.legendPlan}
            </span>
            <span className="flex-1 text-right font-medium text-muted">
              {t.calendar.summary(recordCount, planCount)}
            </span>
          </div>

          <div className="grid grid-cols-7 pb-1 text-center text-[11px] leading-normal font-semibold">
            {t.weekdays.map((d, i) => (
              <span key={d} className={i === 0 ? 'text-coral' : i === 6 ? 'text-brand' : ''}>
                {d}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {weeks.map((week) => (
              <div key={week[0]!.toISOString()} className="grid min-h-[60px] grid-cols-7 lg:min-h-[108px] lg:gap-1">
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

        <div className="px-5 pt-6 lg:mt-6 lg:rounded-3xl lg:bg-white lg:p-5 lg:shadow-card lg:ui-box xl:sticky xl:top-0 xl:mt-0 xl:w-[360px] xl:shrink-0">
          {isLoading || error ? (
            <QueryState isLoading={isLoading} error={error} />
          ) : (
            <DayTimeline day={selected} today={today} records={byDay.get(toDateInput(selected)) ?? []} onEdit={setEditing} onComplete={setCompleted} />
          )}
        </div>
        </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="ui-btn absolute right-5 bottom-5 flex h-14 items-center gap-2 rounded-full bg-brand pr-6 pl-5 text-white shadow-cta retro:h-12 retro:pr-5 retro:pl-4 lg:hidden"
      >
        {retro ? <PixelSprite name="plus" scale={2} /> : <span className="text-[24px] leading-none">+</span>}
        <span className="text-[16px] font-semibold retro:text-[13px]">{t.calendar.addSchedule}</span>
      </button>

      <AnimatePresence>
        {completed && (
          <ConfirmDialog
            title={t.calendar.askAlbumTitle}
            message={
              dayAlbum
                ? t.calendar.askAlbumAddBody(completed.place?.name ?? completed.title, dayAlbum.title)
                : t.calendar.askAlbumBody(completed.place?.name ?? completed.title)
            }
            confirmLabel={addToAlbum.isPending ? t.common.saving : dayAlbum ? t.calendar.askAlbumAddConfirm : t.calendar.askAlbumConfirm}
            error={addToAlbum.error && `${t.common.saveFailed}: ${errorMessage(addToAlbum.error, t)}`}
            busy={addToAlbum.isPending}
            cancelLabel={t.calendar.askAlbumLater}
            onConfirm={() => openAlbumFor(completed)}
            onCancel={() => {
              setCompleted(null)
              addToAlbum.reset()
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
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
      </AnimatePresence>

      <AnimatePresence>
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
      </AnimatePresence>
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
  const t = useT()
  const isDesktop = useIsDesktop()
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
  const visible = inMonth ? records.slice(0, isDesktop ? MAX_BARS_DESKTOP : MAX_BARS) : []
  const hidden = inMonth ? records.length - visible.length : 0

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!inMonth}
      aria-pressed={isSelected}
      aria-label={t.calendar.dayLabel(t.dates.monthDay(day), records.length)}
      className={`ui-pop flex min-w-0 flex-col items-stretch gap-0.5 rounded-xl px-0.5 pt-1 pb-1 lg:gap-1 lg:border lg:px-1.5 lg:pt-1.5 ${
        isSelected ? 'bg-brand-soft lg:border-brand' : 'lg:border-card-border'
      } ${inMonth && !isSelected ? 'lg:hover:bg-cream' : ''}`}
    >
      <span
        className={`mx-auto flex size-7 items-center justify-center rounded-full text-[13px] leading-normal font-semibold lg:mx-0 ${numberColor} ${
          isSelected ? 'bg-brand' : isToday ? 'ring-1 ring-brand' : ''
        }`}
      >
        {day.getDate()}
      </span>
      {visible.map((r) => (
        <span
          key={r.id}
          className={`h-3.5 truncate rounded px-1 text-left text-[9px] leading-[1.556] font-semibold lg:h-5 lg:px-1.5 lg:text-[11px] lg:leading-[18px] ${
            r.type === 'RECORD'
              ? 'border border-transparent bg-brand-soft text-brand-strong'
              : 'border border-coral/45 bg-coral-soft text-coral-strong'
          }`}
        >
          {r.place?.name ?? r.title}
        </span>
      ))}
      {hidden > 0 && <span className="text-left text-[9px] leading-normal font-semibold text-muted lg:text-[11px]">+{hidden}</span>}
    </button>
  )
}
