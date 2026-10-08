import type { Album, Couple, CreateAlbumInput, CreateRecordInput, DateRecord, Place } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? res.statusText)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  couple: () => request<Couple>('/api/couple'),
  places: () => request<Place[]>('/api/places'),
  records: (from: Date, to: Date) =>
    request<DateRecord[]>(
      `/api/records?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`,
    ),
  createRecord: (input: CreateRecordInput) =>
    request<DateRecord>('/api/records', { method: 'POST', body: JSON.stringify(input) }),
  albums: () => request<Album[]>('/api/albums'),
  createAlbum: (input: CreateAlbumInput) =>
    request<Album>('/api/albums', { method: 'POST', body: JSON.stringify(input) }),
}
