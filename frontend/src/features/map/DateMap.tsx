import { Minus, Plus } from 'lucide-react'
import { AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useRef, useState } from 'react'
import Supercluster from 'supercluster'
import dotVisited from '../../assets/icons/dot-visited.svg'
import dotWish from '../../assets/icons/dot-wish.svg'
import locateIcon from '../../assets/icons/locate.svg'
import selectedHalo from '../../assets/icons/selected-halo.svg'
import { PixelSprite } from '../../components/PixelSprite'
import { categoryOf } from '../../lib/categories'
import { MAP_ID, MAP_ID_RETRO, MAPS_API_KEY } from '../../lib/maps'
import { HOME } from '../../lib/home'
import { CATEGORY_SPRITES } from '../../lib/sprites'
import { useIsRetro } from '../../lib/theme'
import type { Place, PlaceStatus } from '../../lib/types'
import { useT } from '../../lib/i18n'
import { useIsDesktop } from '../../lib/useIsDesktop'

const DEFAULT_ZOOM = 12
const WORLD: [number, number, number, number] = [-180, -85, 180, 85]
// Leave room for the place sheet that covers the bottom of the map (phones only).
const FIT_PADDING = { top: 60, right: 60, bottom: 260, left: 40 }
const DESKTOP_FIT_PADDING = { top: 80, right: 80, bottom: 80, left: 80 }

interface Props {
  places: Place[]
  activeStatus: PlaceStatus
  selectedId: number | null
  onSelect: (id: number | null) => void
  /** A Google place icon (shop, sight, …) on the map was tapped. */
  onPoiClick: (googlePlaceId: string) => void
}

export function DateMap(props: Props) {
  // Where this device is, once the locate button has been used; it then follows along.
  const [me, setMe] = useState<google.maps.LatLngLiteral | null>(null)
  const t = useT()
  const retro = useIsRetro()
  const mapId = (retro ? (MAP_ID_RETRO ?? MAP_ID) : MAP_ID) ?? 'DEMO_MAP_ID'
  if (!MAPS_API_KEY) {
    return (
      <div className="flex size-full items-start justify-center bg-[#f1ebd6] pt-16 text-center text-[12px] text-muted">
        {t.map.noApiKey[0]}
        <br />
        {t.map.noApiKey[1]}
      </div>
    )
  }
  return (
    <>
      {/* A map keeps the style it was created with, so switching designs draws a new one. */}
      <Map
        key={mapId}
        mapId={mapId}
        defaultCenter={HOME.center}
        defaultZoom={DEFAULT_ZOOM}
        disableDefaultUI
        gestureHandling="greedy"
        onClick={(e) => {
          if (!e.detail.placeId) return props.onSelect(null)
          // Our own sheet takes the place of Google's info window.
          e.stop()
          props.onPoiClick(e.detail.placeId)
        }}
        className="size-full"
      >
        <Pins {...props} />
        {me && <MyLocation position={me} />}
      </Map>
      <MapControls onLocated={setMe} />
    </>
  )
}

interface PinProps {
  place: Place
}

function Pins({ places, activeStatus, selectedId, onSelect }: Props) {
  const t = useT()
  const retro = useIsRetro()
  const Pin = retro ? RetroPlacePin : PlacePin
  const Cluster = retro ? RetroClusterPin : ClusterPin
  const map = useMap()
  const isDesktop = useIsDesktop()
  const fitted = useRef(false)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const located = useMemo(() => places.filter((p) => p.latitude !== null && p.longitude !== null), [places])
  const selected = located.find((p) => p.id === selectedId)

  // Frame every pin once when the data first arrives.
  useEffect(() => {
    if (!map || fitted.current || located.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    located.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }))
    map.fitBounds(bounds, isDesktop ? DESKTOP_FIT_PADDING : FIT_PADDING)
    fitted.current = true
  }, [map, located, isDesktop])

  useEffect(() => {
    if (map && selected) map.panTo({ lat: selected.latitude!, lng: selected.longitude! })
  }, [map, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps -- pan only when the selection changes

  // Re-cluster once the camera settles rather than on every animation frame.
  useEffect(() => {
    if (!map) return
    const listener = map.addListener('idle', () => setZoom(map.getZoom() ?? DEFAULT_ZOOM))
    return () => listener.remove()
  }, [map])

  // Only the active tab's pins merge into count bubbles as the map zooms out. Dimmed pins and the
  // selected pin always stay on their own.
  const [clustered, loose] = useMemo(() => {
    const isClustered = (p: Place) => p.status === activeStatus && p.id !== selectedId
    return [located.filter(isClustered), located.filter((p) => !isClustered(p))]
  }, [located, activeStatus, selectedId])
  const index = useMemo(() => {
    const cluster = new Supercluster<PinProps>({ radius: 56, maxZoom: 17 })
    cluster.load(
      clustered.map((place) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [place.longitude!, place.latitude!] },
        properties: { place },
      })),
    )
    return cluster
  }, [clustered])
  const features = useMemo(() => index.getClusters(WORLD, zoom), [index, zoom])

  function expand(clusterId: number, lat: number, lng: number) {
    if (!map) return
    map.panTo({ lat, lng })
    map.setZoom(Math.min(index.getClusterExpansionZoom(clusterId), 20))
  }

  function marker(place: Place) {
    const isSelected = place.id === selectedId
    return (
      <AdvancedMarker
        key={place.id}
        position={{ lat: place.latitude!, lng: place.longitude! }}
        title={place.name}
        zIndex={isSelected ? 1000 : place.status === activeStatus ? 10 : 1}
        onClick={() => onSelect(place.id)}
      >
        <Pin place={place} dimmed={place.status !== activeStatus} selected={isSelected} />
      </AdvancedMarker>
    )
  }

  return [
    ...loose.map(marker),
    ...features.map((feature) => {
      if (!('cluster' in feature.properties)) return marker((feature.properties as PinProps).place)
      const { cluster_id: clusterId, point_count: count } = feature.properties
      const [lng, lat] = feature.geometry.coordinates
      return (
        <AdvancedMarker
          key={`cluster-${clusterId}`}
          position={{ lat, lng }}
          title={t.map.cluster(count)}
          zIndex={20}
          onClick={() => expand(clusterId, lat, lng)}
        >
          <Cluster count={count} status={activeStatus} />
        </AdvancedMarker>
      )
    }),
  ]
}

/** Round count bubble for merged pins, coloured like the active tab's pins. */
function ClusterPin({ count, status }: { count: number; status: PlaceStatus }) {
  const size = count < 10 ? 38 : count < 100 ? 44 : 50
  return (
    <div
      className={`flex items-center justify-center rounded-full font-display text-[15px] leading-none shadow-md ${
        status === 'VISITED' ? 'border-3 border-white bg-brand-strong text-white' : 'border-2 border-coral bg-coral-soft text-coral-strong'
      }`}
      style={{ width: size, height: size, transform: 'translateY(50%)' }}
    >
      {count}
    </div>
  )
}

/** Teardrop pin from the design: a square with three rounded corners, rotated so the sharp corner points down. */
function PlacePin({ place, dimmed, selected }: { place: Place; dimmed: boolean; selected: boolean }) {
  const size = selected ? 41.5 : 34
  const visited = place.status === 'VISITED'
  const { Icon } = categoryOf(place.category)
  return (
    <div className={`relative ${dimmed ? 'opacity-32' : ''}`} style={{ width: size, height: size, marginBottom: size * 0.21 }}>
      {selected && <img src={selectedHalo} alt="" width={53.5} height={53.5} className="absolute -top-1.5 -left-1.5 max-w-none" />}
      <div
        className={`absolute inset-0 -rotate-45 rounded-t-full rounded-br-full ${
          visited ? 'border-3 border-white bg-brand-strong' : 'border-2 border-coral bg-coral-soft'
        }`}
      />
      <span className={`absolute inset-0 flex items-center justify-center ${visited ? 'text-white' : 'text-coral-strong'}`}>
        <Icon size={selected ? 18 : 15} strokeWidth={2} />
      </span>
      {selected && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-night px-2.5 py-1 text-[11px] leading-normal font-semibold whitespace-nowrap text-white">
          {place.name}
        </span>
      )}
    </div>
  )
}

/** Pixel design: a square count block in the active tab's colour. */
function RetroClusterPin({ count, status }: { count: number; status: PlaceStatus }) {
  const size = count < 10 ? 32 : count < 100 ? 38 : 44
  return (
    <div
      className={`flex items-center justify-center font-pixel-head text-[15px] leading-none pixel-box pixel-crisp ${
        status === 'VISITED' ? 'bg-brand-strong text-white' : 'bg-coral-soft text-coral-strong [--pixel-border:var(--color-coral-strong)]'
      }`}
      style={{ width: size, height: size, transform: 'translateY(50%)' }}
    >
      {count}
    </div>
  )
}

/** Pixel design: a pixel pin in the status colour with the category inside; the selected one is bigger, hops and shows its name. */
function RetroPlacePin({ place, dimmed, selected }: { place: Place; dimmed: boolean; selected: boolean }) {
  const scale = selected ? 4 : 3
  const color = place.status === 'VISITED' ? 'var(--color-brand)' : 'var(--color-coral)'
  return (
    <div className={`relative ${dimmed ? 'opacity-35' : ''} ${selected ? 'motion-safe:animate-pixel-bob' : ''}`}>
      <PixelSprite name="pin" scale={scale} colors={{ x: color }} />
      {/* The pin's white face spans rows 2–8 of the 12×13 sprite. */}
      <span className="absolute inset-x-0 flex items-center justify-center" style={{ top: scale * 2, height: scale * 7 }}>
        <PixelSprite name={CATEGORY_SPRITES[place.category]} scale={selected ? 3 : 2} />
      </span>
      {selected && (
        <span className="absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 bg-surface px-2 py-1 font-pixel text-[11px] leading-normal whitespace-nowrap pixel-box pixel-thin pixel-crisp">
          {place.name}
        </span>
      )}
    </div>
  )
}

/** The blue dot: where this device is. */
function MyLocation({ position }: { position: google.maps.LatLngLiteral }) {
  const t = useT()
  return (
    <AdvancedMarker position={position} zIndex={1000} title={t.map.myLocation}>
      <span className="relative flex size-5 translate-y-1/2 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand/30 motion-safe:animate-ping retro:rounded-none retro:animate-none" />
        <span className="relative size-3.5 rounded-full border-2 border-white bg-brand-strong shadow-md retro:rounded-none retro:border-0 retro:pixel-outline retro:pixel-thin" />
      </span>
    </AdvancedMarker>
  )
}

function MapControls({ onLocated }: { onLocated: (position: google.maps.LatLngLiteral) => void }) {
  const t = useT()
  const retro = useIsRetro()
  const map = useMap()
  const watching = useRef<number | null>(null)
  const zoom = (delta: number) => map?.setZoom((map.getZoom() ?? 12) + delta)
  // Moves the map to where the device is, then keeps the dot following it while the map is open.
  const locate = () => {
    const geo = navigator.geolocation
    if (!geo) return
    geo.getCurrentPosition(({ coords }) => {
      const here = { lat: coords.latitude, lng: coords.longitude }
      onLocated(here)
      map?.panTo(here)
    })
    watching.current ??= geo.watchPosition(({ coords }) => onLocated({ lat: coords.latitude, lng: coords.longitude }), undefined, {
      maximumAge: 30_000,
    })
  }
  useEffect(
    () => () => {
      if (watching.current !== null) navigator.geolocation.clearWatch(watching.current)
    },
    [],
  )

  return (
    <>
      <div className="ui-float ui-label absolute top-3 left-3 flex gap-3 rounded-full bg-surface/90 lg:top-4 lg:left-4 px-3 py-1.5 text-[11px] leading-normal font-semibold retro:top-3.5 retro:left-3.5 retro:px-2.5 retro:py-1 lg:retro:top-5 lg:retro:left-5">
        <span className="flex items-center gap-1 retro:gap-1.5">
          {retro ? <span className="size-2 bg-brand" /> : <img src={dotVisited} alt="" width={10} height={10} />} {t.status.VISITED}
        </span>
        <span className="flex items-center gap-1 retro:gap-1.5">
          {retro ? <span className="size-2 bg-coral" /> : <img src={dotWish} alt="" width={10} height={10} />} {t.status.WISH}
        </span>
      </div>
      {/* One rounded block in the classic design; two separate pixel buttons in the pixel one. */}
      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-xl bg-surface lg:top-4 lg:right-4 lg:shadow-card retro:top-3.5 retro:right-3.5 retro:gap-3 retro:overflow-visible retro:rounded-none retro:bg-transparent retro:shadow-none lg:retro:top-5 lg:retro:right-5">
        <button type="button" onClick={() => zoom(1)} className="ui-float-button flex size-9 items-center justify-center retro:size-8" aria-label={t.map.zoomIn}>
          {retro ? <PixelSprite name="plus" scale={2} /> : <Plus size={18} strokeWidth={1.75} />}
        </button>
        <button type="button" onClick={() => zoom(-1)} className="ui-float-button flex size-9 items-center justify-center retro:size-8" aria-label={t.map.zoomOut}>
          {retro ? <PixelSprite name="minus" scale={2} /> : <Minus size={18} strokeWidth={1.75} />}
        </button>
      </div>
      <button
        type="button"
        onClick={locate}
        className="ui-float-button absolute right-3 bottom-[250px] flex size-10 lg:right-4 lg:bottom-5 lg:size-11 lg:shadow-card items-center justify-center rounded-full retro:right-3.5 retro:bottom-[254px] retro:size-9 lg:retro:right-5 lg:retro:bottom-6 lg:retro:size-9"
        aria-label={t.map.locate}
      >
        {retro ? <PixelSprite name="locate" scale={2} /> : <img src={locateIcon} alt="" width={18} height={18} />}
      </button>
    </>
  )
}
