import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, ImageError, uploadToStorage, withRetry } from './api'
import { fileFingerprint } from './fingerprint'
import { prepareImage, prepareAvatar } from './images'
import { isVideoFile, prepareVideo, videoContentType } from './videos'
import type { Album, AlbumBase, Feedback, FeedbackTarget, Me, PlaceDetail, UpdateAlbumInput, UpdatePlaceInput, UpdateRecordInput } from './types'
import { addDays, addMonths, parseDateOnly, startOfMonth } from './dates'
import { keepScreenOn } from './wakeLock'

export const keys = {
  me: ['me'] as const,
  places: ['places'] as const,
  place: (id: number) => ['places', id] as const,
  records: (month: Date) => ['records', month.getFullYear(), month.getMonth()] as const,
  recordRange: (from: string, to: string) => ['records', 'range', from, to] as const,
  albums: ['albums'] as const,
  album: (id: number) => ['albums', id] as const,
  albumDownloads: (id: number) => ['albums', id, 'downloads'] as const,
  storage: ['storage'] as const,
  memories: (date: string) => ['memories', date] as const,
  recap: (year: number) => ['recap', year] as const,
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

/** Login, signup, profile edits, and couple setup all answer with the fresh `Me`. */
function useMeMutation<TInput>(mutationFn: (input: TInput) => Promise<Me>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (me) => queryClient.setQueryData(keys.me, me),
  })
}

export const useLogin = () => useMeMutation(api.login)
export const useSignup = () => useMeMutation(api.signup)
/** Signup is closed on the server unless it was opened for someone new; the login screen hides it then. */
export const useSignupOpen = () => useQuery({ queryKey: ['signup'], queryFn: api.signupStatus, staleTime: Infinity, select: (s) => s.open })
export const useCreateCouple = () => useMeMutation(api.createCouple)
export const useJoinCouple = () => useMeMutation(api.joinCouple)
export const useResetPassword = () => useMeMutation(api.resetPassword)

/** Notes and records show the writer's nickname, so a rename refreshes them too. */
export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: (me) => {
      queryClient.setQueryData(keys.me, me)
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== keys.me[0] })
    },
  })
}

export const useUpdateCouple = () => useMeMutation(api.updateCouple)

/** Shrinks the picked photo, puts it straight into storage and makes it the profile photo. */
export const useSetAvatar = () =>
  useMeMutation(async (file: File) => {
    const blob = await prepareAvatar(file)
    const upload = await withRetry(api.avatarUpload)
    await withRetry(() => uploadToStorage(upload, blob))
    return api.setAvatar(upload.key)
  })
export const useRemoveAvatar = () => useMeMutation(api.removeAvatar)
export const useChangePassword = () => useMutation({ mutationFn: api.changePassword })
export const useForgotPassword = () => useMutation({ mutationFn: api.forgotPassword })
export const useIssueResetCode = () => useMutation({ mutationFn: api.issueResetCode })

/**
 * Sets `me` and drops every other cached screen, so what comes next never shows the previous
 * couple's data. `me` is flipped in place (clear() would detach the gate watching it).
 */
function useSwitchMe() {
  const queryClient = useQueryClient()
  return (me: Me | null) => {
    queryClient.setQueryData(keys.me, me)
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== keys.me[0] })
  }
}

export function useLogout() {
  const switchMe = useSwitchMe()
  return useMutation({ mutationFn: api.logout, onSuccess: () => switchMe(null) })
}

/** The couple's records stay with the partner; this account goes back to connecting a couple. */
export function useLeaveCouple() {
  const switchMe = useSwitchMe()
  return useMutation({ mutationFn: api.leaveCouple, onSuccess: switchMe })
}

/** Records stay; the partner's names drop out of what is cached. */
export function useRemovePartner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.removePartner,
    onSuccess: (me) => {
      queryClient.setQueryData(keys.me, me)
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== keys.me[0] })
    },
  })
}

export function useDeleteAccount() {
  const switchMe = useSwitchMe()
  return useMutation({ mutationFn: api.deleteAccount, onSuccess: () => switchMe(null) })
}

export const usePlaces = () => useQuery({ queryKey: keys.places, queryFn: api.places })
export const usePlace = (id: number) => useQuery({ queryKey: keys.place(id), queryFn: () => api.place(id) })

export const useMonthRecords = (month: Date) =>
  useQuery({
    queryKey: keys.records(month),
    queryFn: () => api.records(startOfMonth(month), addMonths(month, 1)),
    placeholderData: (previous) => previous,
  })

/** Records from the first through the last day (`YYYY-MM-DD`, local). */
export const useRangeRecords = (from: string, to: string) =>
  useQuery({
    queryKey: keys.recordRange(from, to),
    queryFn: () => api.records(parseDateOnly(from), addDays(parseDateOnly(to), 1)),
    placeholderData: (previous) => previous,
  })

export const useAlbums = () => useQuery({ queryKey: keys.albums, queryFn: api.albums })
export const useAlbum = (id: number) => useQuery({ queryKey: keys.album(id), queryFn: () => api.album(id) })

export const useStorage = () => useQuery({ queryKey: keys.storage, queryFn: api.storage, staleTime: 0 })
export const useMemories = (date: string) => useQuery({ queryKey: keys.memories(date), queryFn: () => api.memories(date), staleTime: 60 * 60_000 })
export const useRecap = (year: number) =>
  useQuery({ queryKey: keys.recap(year), queryFn: () => api.recap(year), placeholderData: (previous) => previous })

/** Links for saving an album's files. They are good for an hour, so they are asked for again after half of one. */
export function useAlbumDownloads(albumId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient
      .fetchQuery({ queryKey: keys.albumDownloads(albumId), queryFn: () => api.albumDownloads(albumId), staleTime: 30 * 60_000 })
      .then((res) => res.files)
}

/**
 * Reacting to and commenting on a photo or a place memo. The server answers with the target's feedback
 * as it now stands, which goes straight into the cached album or place.
 */
export function useFeedback(target: FeedbackTarget) {
  const queryClient = useQueryClient()
  const apply = (feedback: Feedback) => {
    if (target.kind === 'photo') {
      queryClient.setQueryData<Album>(keys.album(target.albumId), (album) =>
        album && { ...album, photos: album.photos.map((p) => (p.id === target.photoId ? { ...p, ...feedback } : p)) },
      )
    } else {
      queryClient.setQueryData<PlaceDetail>(keys.place(target.placeId), (place) =>
        place && { ...place, notes: place.notes.map((n) => (n.id === target.noteId ? { ...n, ...feedback } : n)) },
      )
    }
  }
  const react = useMutation({
    mutationFn: (emoji: string | null) => (emoji ? api.setReaction(target, emoji) : api.clearReaction(target)),
    onSuccess: apply,
  })
  const comment = useMutation({ mutationFn: (content: string) => api.addComment(target, content), onSuccess: apply })
  const removeComment = useMutation({ mutationFn: (commentId: number) => api.deleteComment(target, commentId), onSuccess: apply })
  return { react, comment, removeComment }
}

/** Records, places and albums all reflect each other (visits rate places, albums list places). */
function useInvalidateDateData() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [['records'], keys.places, keys.albums, keys.storage, ['memories'], ['recap']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
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

export function useUpdatePlaceNote(placeId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: number; content: string }) => api.updatePlaceNote(placeId, noteId, content),
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

/** Adds a visit to an album, keeping the visits it already holds. */
export function useAddRecordToAlbum() {
  const invalidate = useInvalidateDateData()
  return useMutation({
    mutationFn: ({ album, recordId }: { album: Pick<AlbumBase, 'id' | 'recordIds'>; recordId: number }) =>
      api.updateAlbum(album.id, { recordIds: [...new Set([...album.recordIds, recordId])] }),
    onSuccess: invalidate,
  })
}

export function useDeleteRecord() {
  const invalidate = useInvalidateDateData()
  return useMutation({ mutationFn: api.deleteRecord, onSuccess: invalidate })
}

export function useUpdateAlbum(id: number) {
  const invalidate = useInvalidateDateData()
  return useMutation({ mutationFn: (input: UpdateAlbumInput) => api.updateAlbum(id, input), onSuccess: invalidate })
}

export function useCaptionPhoto(albumId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ photoId, caption }: { photoId: number; caption: string }) => api.updatePhoto(albumId, photoId, { caption }),
    onSuccess: (album) => queryClient.setQueryData(keys.album(albumId), album),
  })
}

/** Puts the photos first, keeping their order and that of the rest. */
export function useMovePhotosToFront(albumId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ order, photoIds }: { order: number[]; photoIds: Set<number> }) =>
      api.reorderPhotos(albumId, [...order.filter((id) => photoIds.has(id)), ...order.filter((id) => !photoIds.has(id))]),
    onSuccess: (album) => {
      queryClient.setQueryData(keys.album(albumId), album)
      return queryClient.invalidateQueries({ queryKey: keys.albums, exact: true })
    },
  })
}

/** Moves photos to another album one by one; a file that album already has stays and is counted. */
export function useMovePhotos(albumId: number) {
  const invalidate = useInvalidateDateData()
  return useMutation({
    mutationFn: async ({ photoIds, targetId }: { photoIds: number[]; targetId: number }) => {
      let skipped = 0
      for (const photoId of photoIds) {
        try {
          await api.updatePhoto(albumId, photoId, { albumId: targetId })
        } catch (error) {
          if (!(error instanceof ApiError && error.code === 'PHOTO_EXISTS')) throw error
          skipped++
        }
      }
      return { moved: photoIds.length - skipped, skipped }
    },
    onSettled: invalidate,
  })
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
const FINGERPRINT_CONCURRENCY = 4

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
 * Photos are shrunk with a thumbnail and go up a few at a time; videos go up as shot, one at a time. Each file is
 * recorded as soon as it lands, so whatever made it up stays if the page is left halfway. The screen is kept on
 * meanwhile, since a phone that locks itself stops the upload.
 * Files already in the album (same fingerprint) are skipped and counted in `skipped`; files that fail
 * (e.g. a format the browser can't open) are skipped and counted in `failed`.
 */
export function useUploadPhotos(albumId: number) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDateData()
  // `percent` is how far the video currently uploading has got.
  const [progress, setProgress] = useState<{ done: number; total: number; percent: number | null } | null>(null)
  const mutation = useMutation({
    mutationFn: async (picked: File[]) => {
      // A few at a time: each reads up to 2MB, and a phone holding a hundred of those at once may drop the tab.
      const fingerprints = (await settleWithLimit(picked, FINGERPRINT_CONCURRENCY, fileFingerprint)).map((r) =>
        r.status === 'fulfilled' ? r.value : null,
      )
      const seen = new Set(queryClient.getQueryData<Album>(keys.album(albumId))?.photos.map((p) => p.fingerprint))
      const files: { file: File; fingerprint: string | null }[] = []
      picked.forEach((file, i) => {
        const fingerprint = fingerprints[i]!
        if (fingerprint && seen.has(fingerprint)) return
        if (fingerprint) seen.add(fingerprint)
        files.push({ file, fingerprint })
      })
      const skipped = picked.length - files.length
      const images = files.filter((f) => !isVideoFile(f.file))
      const videos = files.filter((f) => isVideoFile(f.file))
      let done = 0
      let failed = 0
      let firstError: unknown
      const report = (percent: number | null = null) => setProgress({ done, total: files.length, percent })
      report()
      const release = keepScreenOn()
      try {
        for (let start = 0; start < images.length; start += UPLOAD_BATCH) {
          const batch = images.slice(start, start + UPLOAD_BATCH)
          const { uploads } = await withRetry(() => api.photoUploads(albumId, batch.map(() => ({ contentType: 'image/jpeg' }))))
          const results = await settleWithLimit(batch, UPLOAD_CONCURRENCY, async ({ file, fingerprint }, i) => {
            const upload = uploads[i]!
            const image = await prepareImage(file)
            // A failed thumbnail only costs some bandwidth later (the full image is shown), so it doesn't fail the photo.
            const [, thumbnailKey] = await Promise.all([
              withRetry(() => uploadToStorage(upload, image.blob)),
              withRetry(() => uploadToStorage(upload.thumbnail, image.thumbnail)).then(
                () => upload.thumbnail.key,
                () => null,
              ),
            ])
            // A retried confirm of the same key is safe: the server records it once.
            await withRetry(() => api.addPhotos(albumId, [{ key: upload.key, thumbnailKey, takenAt: image.takenAt, fingerprint }]))
            done++
            report()
          })
          failed += results.filter((r) => r.status === 'rejected').length
          firstError ??= results.find((r) => r.status === 'rejected')?.reason
        }
        for (const { file, fingerprint } of videos) {
          try {
            const contentType = videoContentType(file)
            if (!contentType) throw new ImageError(file.name, 'VIDEO_UNSUPPORTED')
            const video = await prepareVideo(file)
            // Asked for right before the PUT: the URL is only good for 10 minutes and earlier videos may take longer.
            const [upload] = (await withRetry(() => api.photoUploads(albumId, [{ contentType }]))).uploads
            report(0)
            // Without a first frame the grid shows a video placeholder instead.
            const [, thumbnailKey] = await Promise.all([
              withRetry(() => uploadToStorage(upload!, file, (fraction) => report(Math.round(fraction * 100)))),
              video.thumbnail
                ? withRetry(() => uploadToStorage(upload!.thumbnail, video.thumbnail!)).then(
                    () => upload!.thumbnail.key,
                    () => null,
                  )
                : null,
            ])
            await withRetry(() =>
              api.addPhotos(albumId, [
                { key: upload!.key, thumbnailKey, takenAt: video.takenAt, durationSec: video.durationSec, fingerprint },
              ]),
            )
          } catch (error) {
            failed++
            firstError ??= error
          }
          done++
          report()
        }
      } finally {
        release()
      }
      if (files.length > 0 && failed === files.length) throw firstError
      return { failed, skipped }
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
