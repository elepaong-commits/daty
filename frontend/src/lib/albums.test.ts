import { expect, it } from 'vitest'
import { cardPhotos } from './albums'
import type { AlbumSummary, Photo } from './types'

const photo = (id: number, mediaType: 'PHOTO' | 'VIDEO' = 'PHOTO') => ({ id, mediaType }) as Photo
const base = { id: 1, photoCount: 4, coverPhoto: photo(3) } as unknown as AlbumSummary

it('uses the list’s preview photos and video count', () => {
  const album = { ...base, previewPhotos: [photo(3), photo(1)], videoCount: 2 }
  expect(cardPhotos(album)).toEqual({ photos: album.previewPhotos, videoCount: 2 })
})

it('works from an older server that still sends every photo', () => {
  const album = { ...base, photos: [photo(1), photo(2, 'VIDEO'), photo(3), photo(4)] } as unknown as AlbumSummary
  const { photos, videoCount } = cardPhotos(album)
  expect(photos.map((p) => p.id)).toEqual([3, 1, 2])
  expect(videoCount).toBe(1)
})

it('copes with neither', () => {
  expect(cardPhotos({ ...base, coverPhoto: null } as unknown as AlbumSummary)).toEqual({ photos: [], videoCount: 0 })
})
