import { AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useRef, useState } from 'react'
import Supercluster from 'supercluster'
import { PixelSprite } from '../../components/PixelSprite'
import { MAP_ID, MAPS_API_KEY } from '../../lib/maps'
import { CATEGORY_SPRITES } from '../../lib/sprites'
import type { Place, PlaceStatus } from '../../lib/types'
import { useT } from '../../lib/i18n'
import { useIsDesktop } from '../../lib/useIsDesktop'

const SEOUL = { lat: 37.5563, lng: 126.9906 }
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
}

export function DateMap(props: Props) {
  const t = useT()
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
      <Map
        mapId={MAP_ID ?? 'DEMO_MAP_ID'}
        defaultCenter={SEOUL}
        defaultZoom={DEFAULT_ZOOM}
        disableDefaultUI
        clickableIcons={false}
        gestureHandling="greedy"
        onClick={() => props.onSelect(null)}
        className="size-full"
      >
        <Pins {...props} />
      </Map>
      <MapControls />
    </>
  )
}

interface PinProps {
  place: Place
}

function Pins({ places, activeStatus, selectedId, onSelect }: Props) {
  const t = useT()
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
        <PlacePin place={place} dimmed={place.status !== activeStatus} selected={isSelected} />
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
          <ClusterPin count={count} status={activeStatus} />
        </AdvancedMarker>
      )
    }),
  ]
}

/** Square count block for merged pins, coloured like the active tab's pins. */
function ClusterPin({ count, status }: { count: number; status: PlaceStatus }) {
  const size = count < 10 ? 32 : count < 100 ? 38 : 44
  return (
    <div
      className={`flex items-center justify-center font-pixel-head text-[15px] leading-none pixel-box pixel-crisp ${
        status === 'VISITED' ? 'bg-brand text-white' : 'bg-coral-soft text-coral-strong [--pixel-border:var(--color-coral-strong)]'
      }`}
      style={{ width: size, height: size, transform: 'translateY(50%)' }}
    >
      {count}
    </div>
  )
}

/** Pixel map pin in the status colour with the category drawn inside; the selected one is bigger, hops and shows its name. */
function PlacePin({ place, dimmed, selected }: { place: Place; dimmed: boolean; selected: boolean }) {
  const scale = selected ? 4 : 3
  const color = place.status === 'VISITED' ? 'var(--color-brand)' : 'var(--color-coral)'
  return (
    <div className={`relative ${dimmed ? 'opacity-35' : ''} ${selected ? 'motion-safe:animate-pixel-bob' : ''}`}>
      <PixelSprite name="pin" scale={scale} colors={{ x: color }} />
      {/* The pin's white face spans columns 2–9 and rows 2–8 of the 12×13 sprite. */}
      <span className="absolute inset-x-0 flex justify-center" style={{ top: scale * 2, height: scale * 7, alignItems: 'center' }}>
        <PixelSprite name={CATEGORY_SPRITES[place.category]} scale={selected ? 3 : 2} />
      </span>
      {selected && (
        <span className="absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 bg-white px-2 py-1 font-pixel text-[11px] leading-normal whitespace-nowrap pixel-box pixel-thin pixel-crisp">
          {place.name}
        </span>
      )}
    </div>
  )
}

function MapControls() {
  const t = useT()
  const map = useMap()
  const zoom = (delta: number) => map?.setZoom((map.getZoom() ?? 12) + delta)
  const locate = () =>
    navigator.geolocation?.getCurrentPosition(({ coords }) => map?.panTo({ lat: coords.latitude, lng: coords.longitude }))

  return (
    <>
      <div className="absolute top-3.5 left-3.5 flex gap-3 bg-white px-2.5 py-1 font-pixel text-[11px] leading-normal pixel-box pixel-thin pixel-crisp lg:top-5 lg:left-5">
        <span className="flex items-center gap-1.5">
          <span className="size-2 bg-brand" /> {t.status.VISITED}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 bg-coral" /> {t.status.WISH}
        </span>
      </div>
      <div className="absolute top-3.5 right-3.5 flex flex-col gap-3 lg:top-5 lg:right-5">
        <button type="button" onClick={() => zoom(1)} className="flex size-8 items-center justify-center bg-white pixel-btn pixel-thin" aria-label={t.map.zoomIn}>
          <PixelSprite name="plus" scale={2} />
        </button>
        <button type="button" onClick={() => zoom(-1)} className="flex size-8 items-center justify-center bg-white pixel-btn pixel-thin" aria-label={t.map.zoomOut}>
          <PixelSprite name="minus" scale={2} />
        </button>
      </div>
      <button
        type="button"
        onClick={locate}
        className="absolute right-3.5 bottom-[254px] flex size-9 items-center justify-center bg-white pixel-btn pixel-thin lg:right-5 lg:bottom-6"
        aria-label={t.map.locate}
      >
        <PixelSprite name="locate" scale={2} />
      </button>
    </>
  )
}
