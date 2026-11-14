import type { AlbumSummary, Photo } from './types'

/**
 * The card's photos and video count. A server from before the slimmer album list sends every photo
 * (`photos`) instead of `previewPhotos`/`videoCount`; the card works from either, so a frontend that
 * goes live before the API doesn't break the album tab.
 */
export function cardPhotos(album: AlbumSummary & { photos?: Photo[] }) {
  if (album.previewPhotos) return { photos: album.previewPhotos, videoCount: album.videoCount ?? 0 }
  const all = album.photos ?? []
  const cover = album.coverPhoto
  return {
    photos: (cover ? [cover, ...all.filter((p) => p.id !== cover.id)] : all).slice(0, 3),
    videoCount: all.filter((p) => p.mediaType === 'VIDEO').length,
  }
}
