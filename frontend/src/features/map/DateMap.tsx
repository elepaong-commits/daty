import { AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useRef, useState } from 'react'
import Supercluster from 'supercluster'
import dotVisited from '../../assets/icons/dot-visited.svg'
import dotWish from '../../assets/icons/dot-wish.svg'
import locateIcon from '../../assets/icons/locate.svg'
import selectedHalo from '../../assets/icons/selected-halo.svg'
import { categoryOf } from '../../lib/categories'
import { MAP_ID, MAPS_API_KEY } from '../../lib/maps'
import type { Place, PlaceStatus } from '../../lib/types'
import { useT } from '../../lib/i18n'

const SEOUL = { lat: 37.5563, lng: 126.9906 }
const DEFAULT_ZOOM = 12
const WORLD: [number, number, number, number] = [-180, -85, 180, 85]
// Leave room for the place sheet that covers the bottom of the map.
const FIT_PADDING = { top: 60, right: 60, bottom: 260, left: 40 }

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
  const fitted = useRef(false)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const located = useMemo(() => places.filter((p) => p.latitude !== null && p.longitude !== null), [places])
  const selected = located.find((p) => p.id === selectedId)

  // Frame every pin once when the data first arrives.
  useEffect(() => {
    if (!map || fitted.current || located.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    located.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }))
    map.fitBounds(bounds, FIT_PADDING)
    fitted.current = true
  }, [map, located])

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

/** Round count bubble for merged pins, coloured like the active tab's pins. */
function ClusterPin({ count, status }: { count: number; status: PlaceStatus }) {
  const size = count < 10 ? 38 : count < 100 ? 44 : 50
  return (
    <div
      className={`flex items-center justify-center rounded-full font-display text-[15px] leading-none shadow-md ${
        status === 'VISITED' ? 'border-3 border-white bg-brand text-white' : 'border-2 border-coral bg-coral-soft text-coral-strong'
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
  return (
    <div className={`relative ${dimmed ? 'opacity-32' : ''}`} style={{ width: size, height: size, marginBottom: size * 0.21 }}>
      {selected && <img src={selectedHalo} alt="" width={53.5} height={53.5} className="absolute -top-1.5 -left-1.5 max-w-none" />}
      <div
        className={`absolute inset-0 -rotate-45 rounded-t-full rounded-br-full ${
          visited ? 'border-3 border-white bg-brand' : 'border-2 border-coral bg-coral-soft'
        }`}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[15px] leading-none">{categoryOf(place.category).emoji}</span>
      {selected && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-ink px-2.5 py-1 text-[11px] leading-normal font-semibold whitespace-nowrap text-white">
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
      <div className="absolute top-3 left-3 flex gap-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] leading-normal font-semibold">
        <span className="flex items-center gap-1">
          <img src={dotVisited} alt="" width={10} height={10} /> {t.status.VISITED}
        </span>
        <span className="flex items-center gap-1">
          <img src={dotWish} alt="" width={10} height={10} /> {t.status.WISH}
        </span>
      </div>
      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-xl bg-white text-[18px] leading-normal font-semibold">
        <button type="button" onClick={() => zoom(1)} className="size-9" aria-label={t.map.zoomIn}>
          +
        </button>
        <button type="button" onClick={() => zoom(-1)} className="size-9" aria-label={t.map.zoomOut}>
          −
        </button>
      </div>
      <button
        type="button"
        onClick={locate}
        className="absolute right-3 bottom-[250px] flex size-10 items-center justify-center rounded-full bg-white"
        aria-label={t.map.locate}
      >
        <img src={locateIcon} alt="" width={18} height={18} />
      </button>
    </>
  )
}
