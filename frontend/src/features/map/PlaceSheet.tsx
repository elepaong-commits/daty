import { useEffect, useRef, useState } from 'react'
import { Stars } from '../../components/Stars'
import { categoryOf, TIPS } from '../../lib/categories'
import { formatMonthDay } from '../../lib/dates'
import type { Place, PlaceStatus } from '../../lib/types'

interface Props {
  places: Place[]
  status: PlaceStatus
  selectedId: number | null
  onSelect: (id: number) => void
}

/** Sheet over the bottom of the map: a swipeable card row, or a full list when expanded. */
export function PlaceSheet({ places, status, selectedId, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false)
  const cardRefs = useRef(new Map<number, HTMLElement>())

  // Bring the card for a tapped pin into view.
  useEffect(() => {
    if (selectedId !== null) cardRefs.current.get(selectedId)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }, [selectedId])

  return (
    <section
      className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-[26px] bg-white shadow-sheet ${expanded ? 'top-0' : 'h-[238px]'}`}
    >
      <button type="button" onClick={() => setExpanded((e) => !e)} className="flex justify-center pt-2.5 pb-1" aria-label={expanded ? '목록 접기' : '목록 펼치기'}>
        <span className="h-1.5 w-10 rounded-full bg-handle" />
      </button>
      <div className="flex items-center justify-between px-5 pb-2.5">
        <h2 className="font-display text-[18px] leading-normal">
          {status === 'VISITED' ? '갔던 ' : '가고 싶은 '}
          <span className="text-brand">{places.length}</span>곳
        </h2>
        <button type="button" onClick={() => setExpanded((e) => !e)} className="text-[12px] font-semibold text-brand">
          {expanded ? '지도 보기' : '전체 보기'}
        </button>
      </div>

      {places.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">
          {status === 'VISITED' ? '아직 다녀온 곳이 없어요' : '가고 싶은 곳을 일정으로 추가해 보세요'}
        </p>
      ) : (
        <div
          className={`scrollbar-none flex gap-3 px-4 pt-0.5 pb-4 ${
            expanded ? 'min-h-0 flex-1 flex-col overflow-y-auto' : 'snap-x snap-mandatory scroll-px-4 overflow-x-auto'
          }`}
        >
          {places.map((place) => (
            <PlaceCard
              key={place.id}
              ref={(el) => {
                if (el) cardRefs.current.set(place.id, el)
                else cardRefs.current.delete(place.id)
              }}
              place={place}
              selected={place.id === selectedId}
              onClick={() => {
                onSelect(place.id)
                setExpanded(false)
              }}
              className={expanded ? 'w-full' : 'w-[325px] max-w-[85%] snap-start'}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PlaceCard({
  place,
  selected,
  onClick,
  className,
  ref,
}: {
  place: Place
  selected: boolean
  onClick: () => void
  className: string
  ref: (el: HTMLButtonElement | null) => void
}) {
  const category = categoryOf(place.category)
  const tip = place.tipType ? TIPS[place.tipType] : null

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex shrink-0 flex-col gap-2 rounded-2xl border-[1.5px] bg-white p-3.5 text-left ${
        selected ? 'border-brand' : 'border-card-border'
      } ${className}`}
    >
      <div className="flex w-full items-start justify-between">
        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] leading-normal font-semibold text-brand-strong">
          {category.emoji} {category.label}
        </span>
        {place.address && <span className="text-[11px] leading-normal text-muted">📍 {place.address}</span>}
      </div>
      <h3 className="w-full truncate font-display text-[19px] leading-[1.375]">{place.name}</h3>
      <div className="flex items-center gap-1.5 leading-normal">
        {place.rating !== null ? (
          <>
            <Stars value={place.rating} />
            <span className="text-[13px] font-bold">{place.rating.toFixed(1)}</span>
          </>
        ) : (
          <span className="text-[12px] text-muted">{place.status === 'WISH' ? '아직 안 가 봤어요' : '별점 없음'}</span>
        )}
        {place.lastVisitedAt && (
          <span className="text-[12px] text-muted">{'·\u3000'}{formatMonthDay(new Date(place.lastVisitedAt))} 방문</span>
        )}
      </div>
      {tip && place.tipText && (
        <div className="flex w-full items-center gap-2">
          <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] leading-normal font-bold ${tip.className}`}>{tip.label}</span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] leading-normal">{place.tipText}</span>
        </div>
      )}
    </button>
  )
}
