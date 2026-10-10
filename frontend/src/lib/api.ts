import type {
  Album,
  CreateAlbumInput,
  CreateRecordInput,
  DateRecord,
  Me,
  Place,
  PlaceDetail,
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
  createCouple: (input: { anniversaryDate: string }) => post<Me>('/api/couple', input),
  joinCouple: (input: { code: string }) => post<Me>('/api/couple/join', input),

  places: () => request<Place[]>('/api/places'),
  place: (id: number) => request<PlaceDetail>(`/api/places/${id}`),
  updatePlace: (id: number, input: UpdatePlaceInput) => patch<Place>(`/api/places/${id}`, input),
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
}

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 맞지 않아요',
  EMAIL_TAKEN: '이미 가입된 이메일이에요',
  RATE_LIMITED: '시도가 너무 많아요. 잠시 후 다시 해 주세요',
  INVALID_CODE: '초대 코드를 다시 확인해 주세요',
  COUPLE_FULL: '이미 두 사람이 연결된 코드예요',
  ALREADY_IN_COUPLE: '이미 커플로 연결되어 있어요',
}

/** Korean message for an API failure, falling back to the raw error. */
export const errorMessage = (error: Error) =>
  (error instanceof ApiError && error.code && MESSAGES[error.code]) || error.message
