import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { MemoText } from '../../components/Memo'
import { PixelSprite } from '../../components/PixelSprite'
import { Stars } from '../../components/Stars'
import { categoryOf } from '../../lib/categories'
import { formatMonthDay } from '../../lib/dates'
import { RISE_IN, riseDelay } from '../../lib/motion'
import { CATEGORY_SPRITES } from '../../lib/sprites'
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
      className={`absolute inset-x-0 bottom-0 flex flex-col border-t-3 border-ink bg-white ${expanded ? 'top-0' : 'h-[238px]'}`}
    >
      <button type="button" onClick={() => setExpanded((e) => !e)} className="flex justify-center pt-2.5 pb-1" aria-label={expanded ? t.map.collapseList : t.map.expandList}>
        <span className="h-1.5 w-10 bg-handle" />
      </button>
      <div className="flex items-center justify-between px-5 pb-2.5">
        <h2 className="font-pixel-head text-[15px] leading-normal pixel-crisp">
          {t.map.sheetHeading[status][0]}
          <span className="text-brand">{places.length}</span>
          {t.map.sheetHeading[status][1]}
        </h2>
        <button type="button" onClick={() => setExpanded((e) => !e)} className="font-pixel text-[11px] text-brand-strong pixel-crisp">
          {expanded ? t.map.viewMap : t.map.viewAll}
        </button>
      </div>

      {places.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">
          {t.map.empty[status]}
        </p>
      ) : (
        <div
          className={`scrollbar-none flex gap-3.5 px-5 pt-1.5 pb-4 ${
            expanded ? 'min-h-0 flex-1 flex-col overflow-y-auto' : 'snap-x snap-mandatory scroll-px-5 overflow-x-auto'
          }`}
        >
          {places.map((place, i) => (
            <PlaceCard
              key={place.id}
              index={i}
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
      <h2 className="px-5 pt-1 pb-2.5 font-pixel-head text-[15px] leading-normal pixel-crisp">
        {t.map.sheetHeading[status][0]}
        <span className="text-brand">{places.length}</span>
        {t.map.sheetHeading[status][1]}
      </h2>
      {places.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">{t.map.empty[status]}</p>
      ) : (
        <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-1.5 pb-5">
          {places.map((place, i) => (
            <PlaceCard
              key={place.id}
              index={i}
              ref={(el) => {
                if (el) cardRefs.current.set(place.id, el)
                else cardRefs.current.delete(place.id)
              }}
              place={place}
              selected={place.id === selectedId}
              onClick={() => onOpen(place.id)}
              className="w-full hover:bg-sand-soft"
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
  index,
  ref,
}: {
  place: Place
  selected: boolean
  onClick: () => void
  className: string
  /** Position in the list, for the order the cards rise in. */
  index: number
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
      style={riseDelay(index)}
      className={`flex shrink-0 flex-col gap-2 bg-white p-3.5 text-left pixel-box ${RISE_IN} ${
        selected ? '[--pixel-border:var(--color-brand)]' : ''
      } ${className}`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap bg-brand-soft px-1.5 py-0.5 font-pixel text-[11px] leading-normal text-brand-strong pixel-crisp">
          <PixelSprite name={CATEGORY_SPRITES[category.value]} scale={2} /> {t.categories[category.value]}
        </span>
        {place.address && <span className="min-w-0 truncate text-[11px] leading-normal text-muted">{place.address}</span>}
      </div>
      <h3 className="w-full truncate font-pixel-head text-[15px] leading-[1.5] pixel-crisp">{place.name}</h3>
      <div className="flex items-center gap-1.5 leading-normal">
        {place.rating !== null ? (
          <>
            <Stars value={place.rating} />
            <span className="font-pixel text-[12px] pixel-crisp">{place.rating.toFixed(1)}</span>
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
