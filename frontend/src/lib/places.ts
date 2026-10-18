import type { PlaceCategory } from './types'

export interface PickedPlace {
  googlePlaceId: string
  name: string
  address?: string
  latitude: number
  longitude: number
  googleMapsUrl?: string
  category?: PlaceCategory
}

/** Countries whose places keep their own name: a place in Japan is saved in Japanese whatever the app language. */
const LOCAL_LANGUAGE: Record<string, string> = { KR: 'ko', JP: 'ja' }

/**
 * A Google place's details as a picked place: name and address in its country's language, a guessed
 * category. Null when Google has no location for it.
 */
export async function lookUpPlace(
  places: google.maps.PlacesLibrary,
  place: google.maps.places.Place,
  lang: string,
  fallbackName = '',
): Promise<PickedPlace | null> {
  await place.fetchFields({
    fields: ['displayName', 'formattedAddress', 'location', 'googleMapsURI', 'addressComponents', 'primaryType', 'types'],
  })
  if (!place.location) return null
  const named = (await inLocalLanguage(places, place, lang)) ?? place
  return {
    googlePlaceId: place.id,
    name: named.displayName ?? fallbackName,
    address: shortAddress(named) ?? undefined,
    latitude: place.location.lat(),
    longitude: place.location.lng(),
    googleMapsUrl: place.googleMapsURI ?? undefined,
    category: categoryFromTypes([place.primaryType, ...(place.types ?? [])]),
  }
}

/**
 * The same place looked up again in its country's language (Japanese for Japan), for its name and address.
 * Null when it is already in that language, the country has no local language set, or the lookup fails.
 */
async function inLocalLanguage(places: google.maps.PlacesLibrary, place: google.maps.places.Place, lang: string) {
  const country = place.addressComponents?.find((c) => c.types.includes('country'))?.shortText
  const local = country && LOCAL_LANGUAGE[country]
  if (!local || local === lang) return null
  try {
    const localPlace = new places.Place({ id: place.id, requestedLanguage: local })
    await localPlace.fetchFields({ fields: ['displayName', 'formattedAddress', 'addressComponents'] })
    return localPlace
  } catch {
    return null
  }
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

// Checked in order: a hotel's restaurant types don't make it a restaurant, and dessert comes before `_restaurant`.
const TYPE_TO_CATEGORY: [string[], PlaceCategory][] = [
  [['lodging', 'hotel', 'motel', 'hostel', 'inn', 'guest_house', 'bed_and_breakfast', 'resort_hotel', 'japanese_inn'], 'HOTEL'],
  [['cafe', 'coffee_shop', 'tea_house'], 'CAFE'],
  [['bakery', 'dessert_shop', 'dessert_restaurant', 'ice_cream_shop', 'confectionery', 'chocolate_shop', 'candy_store', 'donut_shop', 'cake_shop'], 'DESSERT'],
  [['museum', 'art_gallery', 'cultural_center'], 'EXHIBIT'],
  [['restaurant', 'food', 'meal_takeaway', 'bar', 'pub', 'wine_bar'], 'FOOD'],
  [['amusement_park', 'bowling_alley', 'gym', 'movie_theater', 'spa', 'zoo', 'aquarium'], 'ACTIVITY'],
  [['tourist_attraction', 'park', 'natural_feature', 'hiking_area', 'observation_deck', 'historical_landmark', 'historical_place', 'cultural_landmark', 'monument', 'neighborhood', 'plaza', 'garden'], 'TOUR'],
]

function categoryFromTypes(types: (string | null | undefined)[]) {
  for (const [keys, category] of TYPE_TO_CATEGORY) {
    if (types.some((t) => t && (keys.includes(t) || keys.some((k) => t.endsWith(`_${k}`))))) return category
  }
  return undefined
}
