// Mirrors backend/src/modules/*.routes.ts responses. Dates arrive as ISO strings.

export type PlaceCategory = 'FOOD' | 'CAFE' | 'DESSERT' | 'EXHIBIT' | 'TOUR' | 'ACTIVITY' | 'HOTEL'
export type PlaceStatus = 'WISH' | 'VISITED'
export type RecordType = 'PLAN' | 'RECORD'
/** Tags a memo can carry, stored inline as `{{EAT}}` tokens (see `lib/memo.ts`). */
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
  googlePlaceId: string | null
  visitCount: number
  rating: number | null
  lastVisitedAt: string | null
  latestNote: string | null // newest memo, with tag tokens
}

/** One emoji a person left on a photo or memo (each person keeps at most one). */
export interface Reaction {
  userId: number
  emoji: string
}

export interface Comment {
  id: number
  content: string
  createdAt: string
  writer: { id: number; nickname: string } | null
}

/** What the two left on a photo or a place memo. */
export interface Feedback {
  reactions: Reaction[]
  comments: Comment[] // oldest first
}

/** Where feedback goes: a photo in an album or a memo on a place. */
export type FeedbackTarget = { kind: 'photo'; albumId: number; photoId: number } | { kind: 'note'; placeId: number; noteId: number }

export interface PlaceNote extends Feedback {
  id: number
  content: string // may contain `{{EAT}}`-style tag tokens
  createdAt: string
  writer: { id: number; nickname: string } | null
}

export interface CreatePlaceInput {
  name: string
  category: PlaceCategory
  status: PlaceStatus
  googleMapsUrl?: string
  googlePlaceId?: string
  address?: string
  latitude?: number
  longitude?: number
  note?: string // first memo
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

export type MediaType = 'PHOTO' | 'VIDEO'

/** A photo or video in an album. */
export interface Photo {
  id: number
  mediaType: MediaType
  imageUrl: string | null // signed R2 URL (the video itself for a video), valid for at least a day; null if storage is not configured
  // ≤800px copy for grids and cards (a video's first frame); the full image for photos uploaded before thumbnails,
  // null for a video whose frame couldn't be captured
  thumbnailUrl: string | null
  displayOrder: number
  takenAt: string | null
  durationSec: number | null // videos only
  fingerprint: string | null // hash of the original file, to skip it if picked again
  sizeBytes: number | null // what it takes up in storage; null for files uploaded before sizes were kept
  // Only on an album's own photos (not the previews on a place).
  reactions?: Reaction[]
  comments?: Comment[]
}

export interface Album {
  id: number
  title: string
  albumDate: string // YYYY-MM-DD, the first day
  albumEndDate: string // the last day; same as albumDate for a one-day album
  monthly: boolean // a month of everyday photos: spans the month but doesn't hold its days
  highlightNote: string | null
  coverPhotoId: number | null // the "best cut"
  photoCount: number
  coverPhoto: Photo | null
  category: PlaceCategory | null
  places: { id: number; name: string; address: string | null }[]
  recordIds: number[] // the visits bundled into this album
  photos: Photo[]
}

export interface CreateRecordInput {
  type: RecordType
  scheduledAt: string
  category: PlaceCategory
  // A saved place by id, or a name that is matched or created.
  placeId?: number
  placeName?: string
  googleMapsUrl?: string
  // From Google place search; a place without coordinates gets no map pin.
  googlePlaceId?: string
  address?: string
  latitude?: number
  longitude?: number
  memo?: string // about this date
  placeNote?: string // added to the place's own memos
  rating?: number
}

export interface CreateAlbumInput {
  title: string
  albumDate?: string // give this or albumMonth
  albumEndDate?: string | null // null for one day
  albumMonth?: string // YYYY-MM, for a monthly album
  highlightNote?: string
  recordIds?: number[]
  placeIds?: number[] // saved places visited that day; each becomes a visit record in the album
  visitAt?: string // when those visits happened, required with placeIds
}

/** GET /api/places/:id */
export interface PlaceDetail extends Place {
  notes: PlaceNote[] // newest first
  latestVisit: { recordId: number; scheduledAt: string; rating: number | null } | null
  visits: { recordId: number; scheduledAt: string; rating: number | null }[] // newest first
  albums: {
    id: number
    title: string
    albumDate: string
    albumEndDate: string
    monthly: boolean
    coverPhotoId: number | null
    photoCount: number
    coverPhoto: Photo | null // the best cut, or the first photo when none is picked
    photos: Photo[] // first three
  }[]
}

export interface UpdatePlaceInput {
  name?: string
  category?: PlaceCategory
  status?: PlaceStatus
  address?: string | null
  visit?: { scheduledAt: string; rating: number | null }
}

export interface UpdateRecordInput {
  type?: RecordType
  scheduledAt?: string
  category?: PlaceCategory
  memo?: string | null
  placeNote?: string // a new memo for the record's place
  rating?: number | null
  placeId?: number
  placeName?: string
  googleMapsUrl?: string
  googlePlaceId?: string
  address?: string
  latitude?: number
  longitude?: number
}

/** POST /api/albums/:id/photos/uploads: where to PUT one photo or video before registering its key. */
export interface PhotoUpload {
  key: string
  uploadUrl: string
  headers: Record<string, string>
  thumbnail: Omit<PhotoUpload, 'thumbnail'>
}

export interface UpdateAlbumInput {
  title?: string
  albumDate?: string // turns a monthly album back into a dated one
  albumEndDate?: string | null // null makes it one day again
  albumMonth?: string // YYYY-MM, makes it a monthly album
  highlightNote?: string | null
  coverPhotoId?: number | null
  recordIds?: number[]
  placeIds?: number[]
  visitAt?: string
}

/** POST /api/couple/reset-code: a one-time code for the partner who forgot their password. */
export interface ResetCode {
  code: string
  expiresAt: string
  user: { nickname: string }
}

/** GET /api/couple/storage: how much of the photo storage is used. */
export interface StorageUsage {
  usedBytes: number
  freeBytes: number // what the storage plan holds for free
  photos: { count: number; bytes: number }
  videos: { count: number; bytes: number }
  pending: number // files not sized yet
}

/** GET /api/albums/:id/photos/downloads: links that save each file under a readable name. */
export interface AlbumDownload {
  photoId: number
  mediaType: MediaType
  filename: string
  url: string
}

/** GET /api/memories: what happened on this month and day in an earlier year. */
export interface Memory {
  year: number
  yearsAgo: number
  records: {
    id: number
    title: string
    category: PlaceCategory
    rating: number | null
    memo: string | null
    scheduledAt: string
    place: { id: number; name: string } | null
  }[]
  albums: { id: number; title: string; albumDate: string; albumEndDate: string; photoCount: number; coverPhoto: Photo | null }[]
}

interface RecapPlace {
  placeId: number
  name: string
  category: PlaceCategory
  visits: number
  rating: number | null
}

/** GET /api/recap: one year of dates in numbers. */
export interface Recap {
  year: number
  years: number[] // years that can be picked, newest first
  totals: { visits: number; days: number; places: number; newPlaces: number; albums: number; photos: number; videos: number }
  months: number[] // visits in each of the 12 months
  categories: { category: PlaceCategory; count: number }[]
  areas: { name: string; count: number }[]
  mostVisited: RecapPlace[]
  topRated: RecapPlace[]
}
