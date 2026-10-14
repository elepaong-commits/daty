import { Check, Heart } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router'
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
import { PlaceList, PlaceSheet } from './PlaceSheet'
import { useT } from '../../lib/i18n'
import { useIsDesktop } from '../../lib/useIsDesktop'

/** Router state for opening the map on one place, e.g. after editing it. */
export interface MapFocus {
  placeId: number
  status: PlaceStatus
}

/**
 * Map tab. On phones a place opens as its own screen (the `Outlet`); on desktop it opens in the
 * left column next to the map, in place of the list.
 */
export function MapPage() {
  const couple = useMe().data?.couple
  const t = useT()
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const detailMatch = useMatch('/places/:id')
  const detailId = detailMatch ? Number(detailMatch.params.id) : null
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
  // The open place stays highlighted on the desktop map.
  const highlightedId = isDesktop && detailId !== null ? detailId : selectedId

  // Desktop has room to show the place right away; going from one place to another doesn't stack history.
  function openPlace(id: number) {
    setSelectedId(id)
    navigate(`/places/${id}`, { replace: detailId !== null })
  }

  function selectOnMap(id: number | null) {
    if (isDesktop && id !== null) openPlace(id)
    else setSelectedId(id)
  }

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

  if (!isDesktop && detailMatch) return <Outlet />

  const header = (
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
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white lg:hidden"
            aria-label={t.map.search}
            aria-expanded={searchOpen}
          >
            <img src={searchIcon} alt="" width={18} height={18} />
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand shadow-[0_4px_10px_rgba(0,168,150,0.3)] hover:bg-brand-strong"
            aria-label={t.map.addWish}
          >
            <img src={plusIcon} alt="" width={20} height={20} />
          </button>
        </div>
      }
    >
      {(searchOpen || isDesktop) && (
        <input
          autoFocus={!isDesktop}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.map.searchPlaceholder}
          className="mt-3 h-10 w-full rounded-xl border border-sand bg-white px-3 text-[14px] outline-none placeholder:text-placeholder focus:border-brand lg:h-11"
        />
      )}
    </ScreenHeader>
  )

  const filters = (
    <>
      <div className="mx-5 flex h-12 shrink-0 rounded-2xl bg-white p-1" role="tablist">
        {(['VISITED', 'WISH'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => changeStatus(value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] leading-normal font-semibold ${status === value ? 'bg-brand text-white' : 'text-ink'}`}
          >
            {value === 'VISITED' ? <Check size={15} strokeWidth={1.75} /> : <Heart size={15} strokeWidth={1.75} />}
            {t.map.tab[value](counts[value])}
          </button>
        ))}
      </div>

      <div className="scrollbar-none flex shrink-0 gap-2 overflow-x-auto px-5 py-3 lg:flex-wrap lg:overflow-visible">
        <Chip selected={category === null} onClick={() => setCategory(null)} borderClass="border-sand">
          {t.map.all}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.value} selected={category === c.value} onClick={() => setCategory(c.value)} borderClass="border-sand">
            <c.Icon size={14} strokeWidth={1.75} /> {t.categories[c.value]}
          </Chip>
        ))}
      </div>
    </>
  )

  const map = (
    <DateMap places={filtered} activeStatus={status} selectedId={highlightedId} onSelect={selectOnMap} />
  )
  const addSheet = (
    <AnimatePresence>{adding && <AddPlaceSheet onClose={() => setAdding(false)} onSaved={showAdded} />}</AnimatePresence>
  )

  if (isDesktop) {
    return (
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[400px] shrink-0 flex-col border-r border-sand">
          {detailMatch ? (
            <Outlet />
          ) : (
            <>
              {header}
              {filters}
              {isLoading || error ? (
                <QueryState isLoading={isLoading} error={error} />
              ) : (
                <PlaceList places={listed} status={status} selectedId={selectedId} onOpen={openPlace} />
              )}
            </>
          )}
        </div>
        <div className="relative min-w-0 flex-1">{map}</div>
        {addSheet}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {header}
      {filters}

      <div className="relative min-h-0 flex-1">
        {map}
        {isLoading || error ? (
          <div className="absolute inset-x-0 bottom-0 rounded-t-[26px] bg-white shadow-sheet">
            <QueryState isLoading={isLoading} error={error} />
          </div>
        ) : (
          <PlaceSheet places={listed} status={status} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>

      {addSheet}
    </div>
  )
}
