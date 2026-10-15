import { AnimatePresence } from 'motion/react'
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { Chip, QueryState } from '../../components/Field'
import { PixelSprite } from '../../components/PixelSprite'
import { ScreenHeader } from '../../components/ScreenHeader'
import { CATEGORIES } from '../../lib/categories'
import { daysTogether } from '../../lib/dates'
import { CATEGORY_SPRITES } from '../../lib/sprites'
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
            className="flex size-9 shrink-0 items-center justify-center bg-white pixel-btn pixel-thin lg:hidden"
            aria-label={t.map.search}
            aria-expanded={searchOpen}
          >
            <PixelSprite name="search" scale={2} />
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex size-9 shrink-0 items-center justify-center bg-brand pixel-btn pixel-thin hover:bg-brand-strong"
            aria-label={t.map.addWish}
          >
            <PixelSprite name="plus" scale={2} />
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
          className="mt-3.5 h-10 w-full bg-white px-3 font-pixel text-[12px] outline-none pixel-field pixel-crisp placeholder:text-faint"
        />
      )}
    </ScreenHeader>
  )

  const filters = (
    <>
      <div className="mx-5 flex shrink-0 gap-3" role="tablist">
        {(['VISITED', 'WISH'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => changeStatus(value)}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 font-pixel text-[12px] pixel-btn pixel-crisp ${
              status === value ? 'bg-brand text-white hover:bg-brand-strong' : 'bg-white text-ink hover:bg-sand-soft'
            }`}
          >
            {t.map.tab[value](counts[value])}
          </button>
        ))}
      </div>

      <div className="scrollbar-none flex shrink-0 gap-2.5 overflow-x-auto px-5 pt-5 pb-3 lg:flex-wrap lg:overflow-visible">
        <Chip selected={category === null} onClick={() => setCategory(null)}>
          {t.map.all}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.value} selected={category === c.value} onClick={() => setCategory(c.value)}>
            <PixelSprite name={CATEGORY_SPRITES[c.value]} scale={2} /> {t.categories[c.value]}
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
        <div className="flex w-[400px] shrink-0 flex-col border-r-3 border-ink">
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
          <div className="absolute inset-x-0 bottom-0 border-t-3 border-ink bg-white">
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
