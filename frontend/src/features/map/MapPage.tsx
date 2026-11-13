import { Check, Dices, Heart, LocateFixed } from 'lucide-react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { AnimatePresence } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import plusIcon from '../../assets/icons/plus.svg'
import searchIcon from '../../assets/icons/search.svg'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Chip, QueryState } from '../../components/Field'
import { PixelSprite } from '../../components/PixelSprite'
import { ScreenHeader } from '../../components/ScreenHeader'
import { CATEGORIES } from '../../lib/categories'
import { daysTogether } from '../../lib/dates'
import { distanceBetween } from '../../lib/format'
import { useMe, usePlaces } from '../../lib/queries'
import type { Place, PlaceCategory, PlaceStatus } from '../../lib/types'
import { AddPlaceSheet } from './AddPlaceSheet'
import { DateMap } from './DateMap'
import { PlaceList, PlaceSheet } from './PlaceSheet'
import { lookUpPlace, type PickedPlace } from '../../lib/places'
import { useI18n } from '../../lib/i18n'
import { useIsDesktop } from '../../lib/useIsDesktop'
import { useIsRetro } from '../../lib/theme'

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
  const { lang, t } = useI18n()
  const placesLibrary = useMapsLibrary('places')
  const isDesktop = useIsDesktop()
  const retro = useIsRetro()
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
  // A Google place tapped on the map, to start the add sheet from.
  const [tapped, setTapped] = useState<PickedPlace | null>(null)
  const lastTap = useRef('')
  // Where the viewer is, once they ask for wish places nearest first.
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState<'idle' | 'pending' | 'failed'>('idle')

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
  const inTab = filtered.filter((p) => p.status === status)
  // Nearest first; places without a pin can't be measured and go last.
  const listed = useMemo(() => {
    if (!near || status !== 'WISH') return inTab
    const distance = (p: Place) =>
      p.latitude === null || p.longitude === null ? Infinity : distanceBetween(near, { lat: p.latitude, lng: p.longitude })
    return inTab.toSorted((a, b) => distance(a) - distance(b))
  }, [inTab, near, status])
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

  // "Where should we go?": picks one of the wish places on show.
  function pickRandom() {
    const others = listed.length > 1 ? listed.filter((p) => p.id !== selectedId) : listed
    const pick = others[Math.floor(Math.random() * others.length)]
    if (pick) selectOnMap(pick.id)
  }

  function toggleNearby() {
    if (near) {
      setNear(null)
      return
    }
    if (!navigator.geolocation) {
      setLocating('failed')
      return
    }
    setLocating('pending')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNear({ lat: coords.latitude, lng: coords.longitude })
        setLocating('idle')
      },
      () => setLocating('failed'),
      { maximumAge: 60_000, timeout: 10_000 },
    )
  }

  function changeStatus(next: PlaceStatus) {
    setStatus(next)
    setSelectedId(null)
  }

  // Show a place: its tab, no filter hiding it, its card selected.
  function showPlace(place: Place) {
    setStatus(place.status)
    setCategory(null)
    setQuery('')
    setSearchOpen(false)
  }

  function showAdded(place: Place) {
    setAdding(false)
    showPlace(place)
    setSelectedId(place.id)
  }

  function startAdding(initial: PickedPlace | null) {
    setTapped(initial)
    setAdding(true)
  }

  // A place already saved shows as our pin; any other opens the add sheet filled in from Google.
  async function tapPoi(googlePlaceId: string) {
    lastTap.current = googlePlaceId
    const saved = places.find((p) => p.googlePlaceId === googlePlaceId)
    if (saved) {
      showPlace(saved)
      selectOnMap(saved.id)
      return
    }
    if (!placesLibrary) return
    try {
      const found = await lookUpPlace(placesLibrary, new placesLibrary.Place({ id: googlePlaceId }), lang)
      // Ignore a slow lookup once another place has been tapped.
      if (found && lastTap.current === googlePlaceId) startAdding(found)
    } catch {
      // The place couldn't be looked up; the tap does nothing.
    }
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
            className="ui-icon-button bg-white lg:hidden"
            aria-label={t.map.search}
            aria-expanded={searchOpen}
          >
            {retro ? <PixelSprite name="search" scale={2} /> : <img src={searchIcon} alt="" width={18} height={18} />}
          </button>
          <button
            type="button"
            onClick={() => startAdding(null)}
            className="ui-icon-button bg-brand-strong shadow-[0_4px_10px_rgba(0,168,150,0.3)] hover:bg-brand-deep"
            aria-label={t.map.addWish}
          >
            {retro ? <PixelSprite name="plus" scale={2} /> : <img src={plusIcon} alt="" width={20} height={20} />}
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
          className="ui-search"
        />
      )}
    </ScreenHeader>
  )

  const filters = (
    <>
      <div className="ui-tabs mx-5 shrink-0" role="tablist">
        {(['VISITED', 'WISH'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => changeStatus(value)}
            className="ui-tab"
          >
            {!retro && (value === 'VISITED' ? <Check size={15} strokeWidth={1.75} /> : <Heart size={15} strokeWidth={1.75} />)}
            {t.map.tab[value](counts[value])}
          </button>
        ))}
      </div>

      {/* The pixel chips' outlines sit outside them, so the row gets a little more room there. */}
      <div className="scrollbar-none flex shrink-0 gap-2 overflow-x-auto px-5 py-3 [--chip-border:var(--color-sand)] retro:gap-2.5 retro:pt-5 lg:flex-wrap lg:overflow-visible">
        <Chip selected={category === null} onClick={() => setCategory(null)}>
          {t.map.all}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.value} selected={category === c.value} onClick={() => setCategory(c.value)}>
            <CategoryIcon category={c.value} /> {t.categories[c.value]}
          </Chip>
        ))}
      </div>

      {status === 'WISH' && listed.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 pb-3 text-[12px]">
          <button type="button" onClick={pickRandom} className="ui-btn-thin flex h-8 items-center gap-1.5 rounded-full bg-white px-3 font-semibold text-brand-strong retro:text-brand-strong">
            <Dices size={14} strokeWidth={1.75} /> {t.map.randomPick}
          </button>
          <button
            type="button"
            onClick={toggleNearby}
            disabled={locating === 'pending'}
            aria-pressed={near !== null}
            className={`ui-btn-thin flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold disabled:opacity-50 ${
              near ? 'bg-brand-strong text-white' : 'bg-white text-brand-strong retro:text-brand-strong'
            }`}
          >
            <LocateFixed size={14} strokeWidth={1.75} /> {locating === 'pending' ? t.common.wait : t.map.nearby}
          </button>
          {locating === 'failed' && <span className="text-coral-strong">{t.map.nearbyFailed}</span>}
        </div>
      )}
    </>
  )

  const map = (
    <DateMap places={filtered} activeStatus={status} selectedId={highlightedId} onSelect={selectOnMap} onPoiClick={tapPoi} />
  )
  const addSheet = (
    <AnimatePresence>
      {adding && <AddPlaceSheet initial={tapped ?? undefined} onClose={() => setAdding(false)} onSaved={showAdded} />}
    </AnimatePresence>
  )

  if (isDesktop) {
    return (
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[400px] shrink-0 flex-col border-r border-sand retro:border-r-3 retro:border-ink">
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
          <div className="ui-sheet absolute inset-x-0 bottom-0">
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
