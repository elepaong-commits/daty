import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { MemoText } from '../../components/Memo'
import { Stars } from '../../components/Stars'
import { categoryOf } from '../../lib/categories'
import { formatMonthDay } from '../../lib/dates'
import type { Place, PlaceStatus } from '../../lib/types'
import { useT } from '../../lib/i18n'

interface Props {
  places: Place[]
  status: PlaceStatus
  selectedId: number | null
  onSelect: (id: number) => void
}

/**
 * Sheet over the bottom of the map: a swipeable card row, or a full list when expanded.
 * The first tap on a card selects it (and the map pans to it); tapping the selected card opens the place.
 */
export function PlaceSheet({ places, status, selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const t = useT()
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
      <button type="button" onClick={() => setExpanded((e) => !e)} className="flex justify-center pt-2.5 pb-1" aria-label={expanded ? t.map.collapseList : t.map.expandList}>
        <span className="h-1.5 w-10 rounded-full bg-handle" />
      </button>
      <div className="flex items-center justify-between px-5 pb-2.5">
        <h2 className="font-display text-[18px] leading-normal">
          {t.map.sheetHeading[status][0]}
          <span className="text-brand">{places.length}</span>
          {t.map.sheetHeading[status][1]}
        </h2>
        <button type="button" onClick={() => setExpanded((e) => !e)} className="text-[12px] font-semibold text-brand">
          {expanded ? t.map.viewMap : t.map.viewAll}
        </button>
      </div>

      {places.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">
          {t.map.empty[status]}
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
                if (place.id === selectedId) {
                  navigate(`/places/${place.id}`)
                  return
                }
                onSelect(place.id)
                setExpanded(false) // the full list covers the map; drop back to the card row so the pan is visible
              }}
              className={expanded ? 'w-full' : 'w-[325px] max-w-[85%] snap-start'}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** Desktop list beside the map: every card in one scrolling column; a click opens the place. */
export function PlaceList({
  places,
  status,
  selectedId,
  onOpen,
}: {
  places: Place[]
  status: PlaceStatus
  selectedId: number | null
  onOpen: (id: number) => void
}) {
  const t = useT()
  const cardRefs = useRef(new Map<number, HTMLElement>())

  // Bring the card for a clicked pin into view.
  useEffect(() => {
    if (selectedId !== null) cardRefs.current.get(selectedId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="px-5 pt-1 pb-2.5 font-display text-[18px] leading-normal">
        {t.map.sheetHeading[status][0]}
        <span className="text-brand">{places.length}</span>
        {t.map.sheetHeading[status][1]}
      </h2>
      {places.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">{t.map.empty[status]}</p>
      ) : (
        <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pt-0.5 pb-5">
          {places.map((place) => (
            <PlaceCard
              key={place.id}
              ref={(el) => {
                if (el) cardRefs.current.set(place.id, el)
                else cardRefs.current.delete(place.id)
              }}
              place={place}
              selected={place.id === selectedId}
              onClick={() => onOpen(place.id)}
              className="w-full hover:border-brand/50"
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
  const t = useT()

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
      <div className="flex w-full items-start justify-between gap-2">
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-brand-soft px-2 py-0.5 text-[11px] leading-normal font-semibold text-brand-strong">
          <category.Icon size={12} strokeWidth={1.75} /> {t.categories[category.value]}
        </span>
        {place.address && <span className="min-w-0 truncate text-[11px] leading-normal text-muted">{place.address}</span>}
      </div>
      <h3 className="w-full truncate font-display text-[19px] leading-[1.375]">{place.name}</h3>
      <div className="flex items-center gap-1.5 leading-normal">
        {place.rating !== null ? (
          <>
            <Stars value={place.rating} />
            <span className="text-[13px] font-bold">{place.rating.toFixed(1)}</span>
          </>
        ) : (
          <span className="text-[12px] text-muted">{place.status === 'WISH' ? t.common.notVisitedYet : t.map.noRating}</span>
        )}
        {place.lastVisitedAt && (
          <span className="text-[12px] text-muted">{'·\u3000'}{t.map.visitedOn(formatMonthDay(new Date(place.lastVisitedAt)))}</span>
        )}
      </div>
      {place.latestNote && <MemoText content={place.latestNote} className="w-full truncate text-[12.5px] leading-[1.75]" />}
    </button>
  )
}
