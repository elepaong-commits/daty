// Mirrors backend/src/modules/*.routes.ts responses. Dates arrive as ISO strings.

export type PlaceCategory = 'FOOD' | 'CAFE' | 'EXHIBIT' | 'TOUR' | 'BAR' | 'ACTIVITY'
export type PlaceStatus = 'WISH' | 'VISITED'
export type RecordType = 'PLAN' | 'RECORD'
export type TipType = 'EAT' | 'SEE' | 'DO'

export interface Member {
  id: number
  nickname: string
  profileImageUrl: string | null
}

export interface Couple {
  id: number
  coupleCode: string // invite code the partner enters to join
  anniversaryDate: string // YYYY-MM-DD
  users: Member[]
}

/** GET /api/auth/me: the logged-in user and their couple (null until connected). */
export interface Me {
  user: Member & { email: string }
  couple: Couple | null
}

export interface Place {
  id: number
  name: string
  category: PlaceCategory
  status: PlaceStatus
  address: string | null
  latitude: number | null
  longitude: number | null
  googleMapsUrl: string | null
  tipType: TipType | null
  tipText: string | null
  visitCount: number
  rating: number | null
  lastVisitedAt: string | null
}

export interface DateRecord {
  id: number
  placeId: number | null
  albumId: number | null
  type: RecordType
  title: string
  memo: string | null
  category: PlaceCategory
  rating: number | null
  scheduledAt: string
  place: { id: number; name: string; address: string | null; googleMapsUrl: string | null } | null
  writer: { id: number; nickname: string } | null
}

export interface Photo {
  id: number
  imageUrl: string
  displayOrder: number
  takenAt: string | null
}

export interface Album {
  id: number
  title: string
  albumDate: string // YYYY-MM-DD
  highlightNote: string | null
  photoCount: number
  coverPhoto: Photo | null
  category: PlaceCategory | null
  places: { id: number; name: string; address: string | null }[]
  photos: Photo[]
}

export interface CreateRecordInput {
  type: RecordType
  scheduledAt: string
  category: PlaceCategory
  placeName: string
  googleMapsUrl?: string
  // From Google place search; a place without coordinates gets no map pin.
  googlePlaceId?: string
  address?: string
  latitude?: number
  longitude?: number
  memo?: string
  rating?: number
}

export interface CreateAlbumInput {
  title: string
  albumDate: string
  highlightNote?: string
  recordIds?: number[]
}
