import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useId, useRef, useState } from 'react'
import { inputClass } from '../../components/Field'
import { MAPS_API_KEY } from '../../lib/maps'
import type { PlaceCategory } from '../../lib/types'
import { useI18n, useT } from '../../lib/i18n'

export interface PickedPlace {
  googlePlaceId: string
  name: string
  address?: string
  latitude: number
  longitude: number
  googleMapsUrl?: string
  category?: PlaceCategory
}

interface Props {
  name: string
  onNameChange: (name: string) => void
  picked: PickedPlace | null
  onPick: (place: PickedPlace | null) => void
  /** When editing: the record's current place name, which needs no hint while unchanged. */
  currentName?: string
}

const DEBOUNCE_MS = 250

/** Place name field that suggests real places from Google; picking one gives the place a map pin. */
export function PlaceSearch(props: Props) {
  if (!MAPS_API_KEY) {
    return <PlainInput name={props.name} onNameChange={props.onNameChange} />
  }
  return <GooglePlaceSearch {...props} />
}

function PlainInput({ name, onNameChange }: Pick<Props, 'name' | 'onNameChange'>) {
  const t = useT()
  return (
    <input
      required
      maxLength={100}
      value={name}
      onChange={(e) => onNameChange(e.target.value)}
      placeholder={t.placeSearch.plainPlaceholder}
      className={inputClass}
    />
  )
}

function GooglePlaceSearch({ name, onNameChange, picked, onPick, currentName }: Props) {
  const { lang, t } = useI18n()
  const places = useMapsLibrary('places')
  const listId = useId()
  // Results remember which query produced them, so a stale list never shows under new text.
  const [results, setResults] = useState<{ query: string; items: google.maps.places.PlacePrediction[] }>({
    query: '',
    items: [],
  })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loadingPick, setLoadingPick] = useState(false)
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  useEffect(() => {
    const query = name.trim()
    if (!places || picked || query === '') return
    let cancelled = false
    const timer = setTimeout(async () => {
      // One token per typing session keeps the searches and the final lookup billed together.
      sessionToken.current ??= new places.AutocompleteSessionToken()
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: sessionToken.current,
          // Worldwide (trips abroad count too); `region` only favors Korean results when names overlap.
          region: 'kr',
          language: lang,
        })
        if (!cancelled) {
          setResults({ query, items: suggestions.flatMap((s) => (s.placePrediction ? [s.placePrediction] : [])).slice(0, 5) })
          setActive(-1)
        }
      } catch {
        if (!cancelled) setResults({ query, items: [] })
      }
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [places, name, picked, lang])

  async function pick(prediction: google.maps.places.PlacePrediction) {
    setOpen(false)
    setLoadingPick(true)
    try {
      const place = prediction.toPlace()
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'googleMapsURI', 'addressComponents', 'primaryType', 'types'],
      })
      sessionToken.current = null
      if (!place.location) return
      const placeName = place.displayName ?? prediction.mainText?.text ?? name
      onNameChange(placeName)
      onPick({
        googlePlaceId: place.id,
        name: placeName,
        address: shortAddress(place) ?? undefined,
        latitude: place.location.lat(),
        longitude: place.location.lng(),
        googleMapsUrl: place.googleMapsURI ?? undefined,
        category: categoryFromTypes([place.primaryType, ...(place.types ?? [])]),
      })
    } finally {
      setLoadingPick(false)
    }
  }

  const visible = !picked && results.query === name.trim() ? results.items : []
  const showList = open && visible.length > 0

  return (
    <div className="flex flex-col gap-1.5">
      <input
        required
        maxLength={100}
        value={name}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          onNameChange(e.target.value)
          if (picked) onPick(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const step = e.key === 'ArrowDown' ? 1 : -1
            setActive((i) => (i + step + visible.length) % visible.length)
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            pick(visible[active]!)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={t.placeSearch.placeholder}
        className={inputClass}
      />

      {showList && (
        <ul id={listId} role="listbox" className="overflow-hidden rounded-xl border border-field-border bg-white">
          {visible.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
              className={`flex cursor-pointer flex-col border-b border-card-border px-3 py-2 last:border-b-0 ${i === active ? 'bg-brand-soft' : ''}`}
            >
              <span className="text-[14px] font-semibold">{s.mainText?.text ?? s.text.text}</span>
              {s.secondaryText && <span className="truncate text-[11px] text-muted">{s.secondaryText.text}</span>}
            </li>
          ))}
        </ul>
      )}

      {(picked || loadingPick || name.trim() !== currentName) && (
        <p className={`text-[11px] leading-normal font-medium ${picked ? 'text-brand' : 'text-muted'}`}>
          {loadingPick
            ? t.placeSearch.fetching
            : picked
              ? t.placeSearch.picked(picked.address ?? t.placeSearch.located)
              : name.trim()
                ? t.placeSearch.hintTyped
                : t.placeSearch.hintEmpty}
        </p>
      )}
    </div>
  )
}

/** Neighborhood like the design's "성수동" in Korea, or the city abroad. */
function shortAddress(place: google.maps.places.Place) {
  const components = place.addressComponents ?? []
  const find = (type: string) => components.find((c) => c.types.includes(type))?.longText
  const country = components.find((c) => c.types.includes('country'))?.shortText
  if (country === 'KR') {
    const dong = find('sublocality_level_2')?.replace(/\d+가$/, '')
    return dong || find('sublocality_level_1') || find('locality') || place.formattedAddress || null
  }
  // Abroad, Korean-style 동 levels don't exist (Japan's sublocalities are block numbers), so use the city.
  return find('locality') || find('administrative_area_level_2') || find('administrative_area_level_1') || find('country') || null
}

const TYPE_TO_CATEGORY: [string[], PlaceCategory][] = [
  [['cafe', 'coffee_shop', 'bakery', 'dessert_shop', 'tea_house'], 'CAFE'],
  [['bar', 'pub', 'wine_bar', 'night_club'], 'BAR'],
  [['museum', 'art_gallery', 'cultural_center'], 'EXHIBIT'],
  [['restaurant', 'food', 'meal_takeaway'], 'FOOD'],
  [['amusement_park', 'bowling_alley', 'gym', 'movie_theater', 'spa', 'zoo', 'aquarium'], 'ACTIVITY'],
  [['tourist_attraction', 'park', 'natural_feature', 'hiking_area', 'observation_deck', 'historical_landmark', 'historical_place', 'cultural_landmark', 'monument', 'neighborhood', 'plaza', 'garden'], 'TOUR'],
]

function categoryFromTypes(types: (string | null | undefined)[]) {
  for (const [keys, category] of TYPE_TO_CATEGORY) {
    if (types.some((t) => t && (keys.includes(t) || keys.some((k) => t.endsWith(`_${k}`))))) return category
  }
  return undefined
}
