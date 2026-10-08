import { AdvancedMarker, APIProvider, Map, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useRef } from 'react'
import dotVisited from '../../assets/icons/dot-visited.svg'
import dotWish from '../../assets/icons/dot-wish.svg'
import locateIcon from '../../assets/icons/locate.svg'
import selectedHalo from '../../assets/icons/selected-halo.svg'
import { categoryOf } from '../../lib/categories'
import type { Place, PlaceStatus } from '../../lib/types'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined
const SEOUL = { lat: 37.5563, lng: 126.9906 }
// Leave room for the place sheet that covers the bottom of the map.
const FIT_PADDING = { top: 60, right: 60, bottom: 260, left: 40 }

interface Props {
  places: Place[]
  activeStatus: PlaceStatus
  selectedId: number | null
  onSelect: (id: number | null) => void
}

export function DateMap(props: Props) {
  if (!API_KEY) {
    return (
      <div className="flex size-full items-start justify-center bg-[#f1ebd6] pt-16 text-center text-[12px] text-muted">
        지도를 보려면 frontend/.env.local에
        <br />
        VITE_GOOGLE_MAPS_API_KEY를 넣어 주세요
      </div>
    )
  }
  return (
    <APIProvider apiKey={API_KEY} language="ko" region="KR">
      <Map
        mapId={MAP_ID ?? 'DEMO_MAP_ID'}
        defaultCenter={SEOUL}
        defaultZoom={12}
        disableDefaultUI
        clickableIcons={false}
        gestureHandling="greedy"
        onClick={() => props.onSelect(null)}
        className="size-full"
      >
        <Pins {...props} />
      </Map>
      <MapControls />
    </APIProvider>
  )
}

function Pins({ places, activeStatus, selectedId, onSelect }: Props) {
  const map = useMap()
  const fitted = useRef(false)
  const located = places.filter((p) => p.latitude !== null && p.longitude !== null)

  // Frame every pin once when the data first arrives.
  useEffect(() => {
    if (!map || fitted.current || located.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    located.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }))
    map.fitBounds(bounds, FIT_PADDING)
    fitted.current = true
  }, [map, located])

  useEffect(() => {
    const target = located.find((p) => p.id === selectedId)
    if (map && target) map.panTo({ lat: target.latitude!, lng: target.longitude! })
  }, [map, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps -- pan only when the selection changes

  return located.map((place) => {
    const selected = place.id === selectedId
    return (
      <AdvancedMarker
        key={place.id}
        position={{ lat: place.latitude!, lng: place.longitude! }}
        title={place.name}
        zIndex={selected ? 1000 : place.status === activeStatus ? 10 : 1}
        onClick={() => onSelect(place.id)}
      >
        <PlacePin place={place} dimmed={place.status !== activeStatus} selected={selected} />
      </AdvancedMarker>
    )
  })
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
  const map = useMap()
  const zoom = (delta: number) => map?.setZoom((map.getZoom() ?? 12) + delta)
  const locate = () =>
    navigator.geolocation?.getCurrentPosition(({ coords }) => map?.panTo({ lat: coords.latitude, lng: coords.longitude }))

  return (
    <>
      <div className="absolute top-3 left-3 flex gap-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] leading-normal font-semibold">
        <span className="flex items-center gap-1">
          <img src={dotVisited} alt="" width={10} height={10} /> 갔던 곳
        </span>
        <span className="flex items-center gap-1">
          <img src={dotWish} alt="" width={10} height={10} /> 가고 싶은 곳
        </span>
      </div>
      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-xl bg-white text-[18px] leading-normal font-semibold">
        <button type="button" onClick={() => zoom(1)} className="size-9" aria-label="확대">
          +
        </button>
        <button type="button" onClick={() => zoom(-1)} className="size-9" aria-label="축소">
          −
        </button>
      </div>
      <button
        type="button"
        onClick={locate}
        className="absolute right-3 bottom-[250px] flex size-10 items-center justify-center rounded-full bg-white"
        aria-label="현재 위치로 이동"
      >
        <img src={locateIcon} alt="" width={18} height={18} />
      </button>
    </>
  )
}
