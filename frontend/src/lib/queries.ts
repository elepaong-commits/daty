import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, ImageError, uploadToStorage } from './api'
import { prepareImage } from './images'
import { isVideoFile, prepareVideo, videoContentType } from './videos'
import type { Me, UpdateAlbumInput, UpdatePlaceInput, UpdateRecordInput } from './types'
import { addMonths, startOfMonth } from './dates'

export const keys = {
  me: ['me'] as const,
  places: ['places'] as const,
  place: (id: number) => ['places', id] as const,
  records: (month: Date) => ['records', month.getFullYear(), month.getMonth()] as const,
  albums: ['albums'] as const,
  album: (id: number) => ['albums', id] as const,
}

/** `null` means logged out; the backend answers 401 rather than an empty user. */
export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: () =>
      api.me().catch((err) => {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }),
    staleTime: Infinity,
  })

/** Login, signup, and couple setup all answer with the fresh `Me`. */
function useMeMutation<TInput>(mutationFn: (input: TInput) => Promise<Me>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (me) => queryClient.setQueryData(keys.me, me),
  })
}

export const useLogin = () => useMeMutation(api.login)
export const useSignup = () => useMeMutation(api.signup)
export const useCreateCouple = () => useMeMutation(api.createCouple)
export const useJoinCouple = () => useMeMutation(api.joinCouple)
export const useResetPassword = () => useMeMutation(api.resetPassword)
export const useChangePassword = () => useMutation({ mutationFn: api.changePassword })
export const useIssueResetCode = () => useMutation({ mutationFn: api.issueResetCode })

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      // Flip `me` in place (clear() would detach the gate watching it), then drop every
      // other cached screen so the next account never sees the previous one's data.
      queryClient.setQueryData(keys.me, null)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== keys.me[0] })
    },
  })
}

export const usePlaces = () => useQuery({ queryKey: keys.places, queryFn: api.places })
export const usePlace = (id: number) => useQuery({ queryKey: keys.place(id), queryFn: () => api.place(id) })

export const useMonthRecords = (month: Date) =>
  useQuery({
    queryKey: keys.records(month),
    queryFn: () => api.records(startOfMonth(month), addMonths(month, 1)),
    placeholderData: (previous) => previous,
  })

export const useAlbums = () => useQuery({ queryKey: keys.albums, queryFn: api.albums })
export const useAlbum = (id: number) => useQuery({ queryKey: keys.album(id), queryFn: () => api.album(id) })

/** Records, places and albums all reflect each other (visits rate places, albums list places). */
function useInvalidateDateData() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [['records'], keys.places, keys.albums].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
}

export function useCreatePlace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createPlace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.places }),
  })
}

/** Memos only show on places (detail and map cards), so the places cache is all that changes. */
export function useAddPlaceNote(placeId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => api.addPlaceNote(placeId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.places }),
  })
}

export function useDeletePlaceNote(placeId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (noteId: number) => api.deletePlaceNote(placeId, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.places }),
  })
}

export function useUpdatePlace(id: number) {
  const invalidate = useInvalidateDateData()
  return useMutation({ mutationFn: (input: UpdatePlaceInput) => api.updatePlace(id, input), onSuccess: invalidate })
}

/** Notes go with the place; its records stay on the calendar without a place. */
export function useDeletePlace(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.deletePlace(id),
    onSuccess: () =>
      // Skip the deleted place's own detail query: refetching it would only 404 while the page leaves.
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          ['records', keys.places[0], keys.albums[0]].includes(queryKey[0] as string) && queryKey[1] !== id,
      }),
  })
}

export function useUpdateRecord(id: number) {
  const invalidate = useInvalidateDateData()
  return useMutation({ mutationFn: (input: UpdateRecordInput) => api.updateRecord(id, input), onSuccess: invalidate })
}

export function useDeleteRecord() {
  const invalidate = useInvalidateDateData()
  return useMutation({ mutationFn: api.deleteRecord, onSuccess: invalidate })
}

export function useUpdateAlbum(id: number) {
  const invalidate = useInvalidateDateData()
  return useMutation({ mutationFn: (input: UpdateAlbumInput) => api.updateAlbum(id, input), onSuccess: invalidate })
}

export function useDeletePhotos(albumId: number) {
  const invalidate = useInvalidateDateData()
  return useMutation({
    mutationFn: async (photoIds: number[]) => {
      for (const photoId of photoIds) await api.deletePhoto(albumId, photoId)
    },
    onSuccess: invalidate,
  })
}

const UPLOAD_BATCH = 30 // backend limit per request
const UPLOAD_CONCURRENCY = 3

/** Runs `fn` over `items` with at most `limit` in flight, keeping per-item outcomes in order. */
async function settleWithLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!, i).then(
        (value) => ({ status: 'fulfilled', value }) as const,
        (reason: unknown) => ({ status: 'rejected', reason }) as const,
      )
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * Uploads picked photos and videos straight to R2, then records the keys on the album.
 * Photos are shrunk with a thumbnail and go up in batches; videos go up as shot, one at a time, each
 * recorded as soon as it lands so a long upload isn't lost if the page is left halfway.
 * Files that fail (e.g. a format the browser can't open) are skipped and counted in `failed`.
 */
export function useUploadPhotos(albumId: number) {
  const invalidate = useInvalidateDateData()
  // `percent` is how far the video currently uploading has got.
  const [progress, setProgress] = useState<{ done: number; total: number; percent: number | null } | null>(null)
  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      const images = files.filter((f) => !isVideoFile(f))
      const videos = files.filter(isVideoFile)
      let done = 0
      let failed = 0
      let firstError: unknown
      const report = (percent: number | null = null) => setProgress({ done, total: files.length, percent })
      report()
      for (let start = 0; start < images.length; start += UPLOAD_BATCH) {
        const batch = images.slice(start, start + UPLOAD_BATCH)
        const { uploads } = await api.photoUploads(albumId, batch.map(() => ({ contentType: 'image/jpeg' })))
        const results = await settleWithLimit(batch, UPLOAD_CONCURRENCY, async (file, i) => {
          const upload = uploads[i]!
          const image = await prepareImage(file)
          // A failed thumbnail only costs some bandwidth later (the full image is shown), so it doesn't fail the photo.
          const [, thumbnailKey] = await Promise.all([
            uploadToStorage(upload, image.blob),
            uploadToStorage(upload.thumbnail, image.thumbnail).then(
              () => upload.thumbnail.key,
              () => null,
            ),
          ])
          done++
          report()
          return { key: upload.key, thumbnailKey, takenAt: image.takenAt }
        })
        const photos = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
        failed += batch.length - photos.length
        firstError ??= results.find((r) => r.status === 'rejected')?.reason
        // Order the day's shots by when they were taken; ones without EXIF go last.
        photos.sort((a, b) => (a.takenAt ?? '\uffff').localeCompare(b.takenAt ?? '\uffff'))
        if (photos.length > 0) await api.addPhotos(albumId, photos)
      }
      for (const file of videos) {
        try {
          const contentType = videoContentType(file)
          if (!contentType) throw new ImageError(file.name, 'VIDEO_UNSUPPORTED')
          const video = await prepareVideo(file)
          // Asked for right before the PUT: the URL is only good for 10 minutes and earlier videos may take longer.
          const [upload] = (await api.photoUploads(albumId, [{ contentType }])).uploads
          report(0)
          // Without a first frame the grid shows a video placeholder instead.
          const [, thumbnailKey] = await Promise.all([
            uploadToStorage(upload!, file, (fraction) => report(Math.round(fraction * 100))),
            video.thumbnail
              ? uploadToStorage(upload!.thumbnail, video.thumbnail).then(
                  () => upload!.thumbnail.key,
                  () => null,
                )
              : null,
          ])
          await api.addPhotos(albumId, [{ key: upload!.key, thumbnailKey, takenAt: video.takenAt, durationSec: video.durationSec }])
        } catch (error) {
          failed++
          firstError ??= error
        }
        done++
        report()
      }
      if (failed === files.length) throw firstError
      return { failed }
    },
    onSettled: () => {
      setProgress(null)
      return invalidate()
    },
  })
  return { ...mutation, progress }
}

export function useCreateRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createRecord,
    // A new record can create or promote a place, so the map needs a refresh too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['records'] }),
        queryClient.invalidateQueries({ queryKey: keys.places }),
      ]),
  })
}

export function useCreateAlbum() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createAlbum,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.albums }),
  })
}
