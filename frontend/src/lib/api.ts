import type { Messages } from './messages'
import type {
  Album,
  CreateAlbumInput,
  CreatePlaceInput,
  CreateRecordInput,
  DateRecord,
  Me,
  Place,
  PhotoUpload,
  ResetCode,
  PlaceDetail,
  PlaceNote,
  UpdateAlbumInput,
  UpdatePlaceInput,
  UpdateRecordInput,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  /** Machine-readable reason from the backend, e.g. `INVALID_CREDENTIALS`. */
  readonly code: string | undefined

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.code)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const send =
  (method: 'POST' | 'PATCH' | 'DELETE') =>
  <T>(path: string, body?: unknown) =>
    request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
const post = send('POST')
const patch = send('PATCH')
const del = send('DELETE')

export const api = {
  me: () => request<Me>('/api/auth/me'),
  login: (input: { email: string; password: string }) => post<Me>('/api/auth/login', input),
  signup: (input: { email: string; password: string; nickname: string }) => post<Me>('/api/auth/signup', input),
  logout: () => post<void>('/api/auth/logout'),
  changePassword: (input: { currentPassword: string; newPassword: string }) => post<void>('/api/auth/password', input),
  resetPassword: (input: { email: string; code: string; newPassword: string }) =>
    post<Me>('/api/auth/reset-password', input),
  issueResetCode: () => post<ResetCode>('/api/couple/reset-code'),
  createCouple: (input: { anniversaryDate: string }) => post<Me>('/api/couple', input),
  joinCouple: (input: { code: string }) => post<Me>('/api/couple/join', input),

  places: () => request<Place[]>('/api/places'),
  place: (id: number) => request<PlaceDetail>(`/api/places/${id}`),
  createPlace: (input: CreatePlaceInput) => post<Place>('/api/places', input),
  updatePlace: (id: number, input: UpdatePlaceInput) => patch<Place>(`/api/places/${id}`, input),
  addPlaceNote: (placeId: number, content: string) => post<PlaceNote>(`/api/places/${placeId}/notes`, { content }),
  deletePlaceNote: (placeId: number, noteId: number) => del<void>(`/api/places/${placeId}/notes/${noteId}`),
  records: (from: Date, to: Date) =>
    request<DateRecord[]>(
      `/api/records?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`,
    ),
  createRecord: (input: CreateRecordInput) => post<DateRecord>('/api/records', input),
  updateRecord: (id: number, input: UpdateRecordInput) => patch<DateRecord>(`/api/records/${id}`, input),
  deleteRecord: (id: number) => del<void>(`/api/records/${id}`),
  albums: () => request<Album[]>('/api/albums'),
  album: (id: number) => request<Album>(`/api/albums/${id}`),
  updateAlbum: (id: number, input: UpdateAlbumInput) => patch<Album>(`/api/albums/${id}`, input),
  deletePhoto: (albumId: number, photoId: number) => del<void>(`/api/albums/${albumId}/photos/${photoId}`),
  createAlbum: (input: CreateAlbumInput) => post<Album>('/api/albums', input),
  photoUploads: (albumId: number, files: { contentType: string }[]) =>
    post<{ uploads: PhotoUpload[] }>(`/api/albums/${albumId}/photos/uploads`, { files }),
  addPhotos: (albumId: number, photos: { key: string; thumbnailKey: string | null; takenAt: string | null }[]) =>
    post<Album>(`/api/albums/${albumId}/photos`, { photos }),
}

/** PUT an image straight to R2 with a presigned URL: no API base and no cookies. */
export async function uploadToStorage(upload: Omit<PhotoUpload, 'thumbnail'>, body: Blob) {
  const res = await fetch(upload.uploadUrl, { method: 'PUT', headers: upload.headers, body })
  if (!res.ok) throw new ApiError(res.status, `R2 upload failed: ${res.status}`)
}

/** A photo that could not be prepared for upload; `code` picks the message. */
export class ImageError extends Error {
  readonly code: 'IMAGE_UNREADABLE' | 'IMAGE_ENCODE_FAILED'

  constructor(fileName: string, code: ImageError['code']) {
    super(fileName)
    this.code = code
  }
}

/** Localized message for a failure, falling back to the raw error. */
export function errorMessage(error: Error, t: Messages) {
  if (error instanceof ImageError) return `${error.message}: ${t.errors[error.code]}`
  return (error instanceof ApiError && error.code && t.errors[error.code]) || error.message
}
