import { useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import plusIcon from '../../assets/icons/plus.svg'
import searchIcon from '../../assets/icons/search.svg'
import { Chip, QueryState } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { CATEGORIES } from '../../lib/categories'
import { daysTogether } from '../../lib/dates'
import { useMe, usePlaces } from '../../lib/queries'
import type { Place, PlaceCategory, PlaceStatus } from '../../lib/types'
import { AddPlaceSheet } from './AddPlaceSheet'
import { DateMap } from './DateMap'
import { PlaceSheet } from './PlaceSheet'
import { useT } from '../../lib/i18n'

/** Router state for opening the map on one place, e.g. after editing it. */
export interface MapFocus {
  placeId: number
  status: PlaceStatus
}

export function MapPage() {
  const couple = useMe().data?.couple
  const t = useT()
  const { data: places = [], isLoading, error } = usePlaces()
  const focus = useLocation().state as MapFocus | null
  const [status, setStatus] = useState<PlaceStatus>(focus?.status ?? 'VISITED')
  const [category, setCategory] = useState<PlaceCategory | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(focus?.placeId ?? null)
  const [adding, setAdding] = useState(false)

  // Category and search narrow both the pins and the cards; status only dims the other pins.
  const filtered = useMemo(
    () =>
      places.filter(
        (p) => (category === null || p.category === category) && p.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [places, category, query],
  )
  const counts = {
    VISITED: places.filter((p) => p.status === 'VISITED').length,
    WISH: places.filter((p) => p.status === 'WISH').length,
  }
  const listed = filtered.filter((p) => p.status === status)

  function changeStatus(next: PlaceStatus) {
    setStatus(next)
    setSelectedId(null)
  }

  // Show the new place: its tab, no filter hiding it, its card selected.
  function showAdded(place: Place) {
    setAdding(false)
    setStatus(place.status)
    setCategory(null)
    setQuery('')
    setSearchOpen(false)
    setSelectedId(place.id)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        eyebrow={t.map.eyebrow(couple ? daysTogether(couple.anniversaryDate) : null)}
        title={t.map.title}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((open) => !open)
                setQuery('')
              }}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white"
              aria-label={t.map.search}
              aria-expanded={searchOpen}
            >
              <img src={searchIcon} alt="" width={18} height={18} />
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand shadow-[0_4px_10px_rgba(0,168,150,0.3)]"
              aria-label={t.map.addWish}
            >
              <img src={plusIcon} alt="" width={20} height={20} />
            </button>
          </div>
        }
      >
        {searchOpen && (
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.map.searchPlaceholder}
            className="mt-3 h-10 w-full rounded-xl border border-sand bg-white px-3 text-[14px] outline-none placeholder:text-placeholder focus:border-brand"
          />
        )}
      </ScreenHeader>

      <div className="mx-5 flex h-12 shrink-0 rounded-2xl bg-white p-1" role="tablist">
        {(['VISITED', 'WISH'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => changeStatus(value)}
            className={`flex-1 rounded-xl text-[14px] leading-normal font-semibold ${status === value ? 'bg-brand text-white' : 'text-ink'}`}
          >
            {t.map.tab[value](counts[value])}
          </button>
        ))}
      </div>

      <div className="scrollbar-none flex shrink-0 gap-2 overflow-x-auto px-5 py-3">
        <Chip selected={category === null} onClick={() => setCategory(null)} borderClass="border-sand">
          {t.map.all}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.value} selected={category === c.value} onClick={() => setCategory(c.value)} borderClass="border-sand">
            {c.emoji} {t.categories[c.value]}
          </Chip>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        <DateMap places={filtered} activeStatus={status} selectedId={selectedId} onSelect={setSelectedId} />
        {isLoading || error ? (
          <div className="absolute inset-x-0 bottom-0 rounded-t-[26px] bg-white shadow-sheet">
            <QueryState isLoading={isLoading} error={error} />
          </div>
        ) : (
          <PlaceSheet places={listed} status={status} selectedId={selectedId} />
        )}
      </div>

      {adding && <AddPlaceSheet onClose={() => setAdding(false)} onSaved={showAdded} />}
    </div>
  )
}
