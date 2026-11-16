import { ArrowDown, ArrowUp, Check, MapPin, MessageCircle, Play, Star, TriangleAlert, Video } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router'
import { QueryState } from '../../components/Field'
import { HeaderAction, SubHeader } from '../../components/SubHeader'
import { api, errorMessage } from '../../lib/api'
import { saveMode } from '../../lib/download'
import { useSaveFiles } from '../../lib/useSaveFiles'
import { SaveReadyBar } from './SaveReadyBar'
import { MovePhotosSheet } from './MovePhotosSheet'
import { formatBytes } from '../../lib/format'
import { albumHeading, daysBetween, formatDotted, formatDuration, formatMonthDay, parseDateOnly } from '../../lib/dates'
import { RISE_IN, riseDelay } from '../../lib/motion'
import { keys, useAlbum, useAlbumDownloads, useDeletePhotos, useMovePhotos, useMovePhotosToFront, useUpdateAlbum, useUploadPhotos } from '../../lib/queries'
import { isVideoFile } from '../../lib/videos'
import { useT } from '../../lib/i18n'
import type { MediaType, Photo } from '../../lib/types'
import { useImageFailed } from '../../lib/useImageFailed'
import { EditAlbumSheet } from './EditAlbumSheet'
import { PhotoViewer } from './PhotoViewer'
import { useConfirm } from '../../lib/confirm'

type MediaFilter = 'ALL' | MediaType
const FILTERS: MediaFilter[] = ['ALL', 'PHOTO', 'VIDEO']

// Upload order is `displayOrder`; taken order keeps items without a capture time last either way.
type SortOrder = 'UPLOADED' | 'TAKEN'
type SortDirection = 'ASC' | 'DESC'
const SORTS: SortOrder[] = ['UPLOADED', 'TAKEN']
const SORT_STORAGE_KEY = 'daty.albumSort'
const DIRECTION_STORAGE_KEY = 'daty.albumSortDirection'
// Videos go up as shot, so a big batch is worth a second look before it eats the free storage.
const BIG_VIDEO_BYTES = 300 * 1000 ** 2

function sortItems(items: Photo[], sort: SortOrder, direction: SortDirection) {
  const sign = direction === 'ASC' ? 1 : -1
  return items.toSorted((a, b) => {
    if (sort === 'TAKEN') {
      if (!a.takenAt !== !b.takenAt) return a.takenAt ? -1 : 1
      const byTime = a.takenAt && b.takenAt ? a.takenAt.localeCompare(b.takenAt) : 0
      if (byTime !== 0) return sign * byTime
    }
    return sign * (a.displayOrder - b.displayOrder)
  })
}

/** The viewer's last pick, remembered on this device; `fallback` when missing or unreadable. */
function saved<T extends string>(key: string, values: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return values.find((v) => v === value) ?? fallback
  } catch {
    return fallback
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode etc.: the order just isn't remembered.
  }
}

export function AlbumDetailPage() {
  const id = Number(useParams().id)
  const { data: album, isLoading, error } = useAlbum(id)
  const t = useT()
  const confirm = useConfirm()
  const updateAlbum = useUpdateAlbum(id)
  const deletePhotos = useDeletePhotos(id)
  const toFront = useMovePhotosToFront(id)
  const movePhotos = useMovePhotos(id)
  const [moving, setMoving] = useState(false)
  const uploadPhotos = useUploadPhotos(id)
  const fileInput = useRef<HTMLInputElement>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState<MediaFilter>('ALL')
  const [sort, setSort] = useState(() => saved(SORT_STORAGE_KEY, SORTS, 'UPLOADED'))
  const [direction, setDirection] = useState(() => saved<SortDirection>(DIRECTION_STORAGE_KEY, ['ASC', 'DESC'], 'ASC'))
  const [viewing, setViewing] = useState<number | null>(null) // index in `shown` of the item open in the viewer
  const queryClient = useQueryClient()
  const loadDownloads = useAlbumDownloads(id)
  const saver = useSaveFiles(loadDownloads)
  const saveProgress = saver.state.phase === 'idle' ? null : saver.state
  const saveError = saver.error

  function toggleSelecting() {
    setSelecting((on) => !on)
    setSelected(new Set())
  }

  function toggle(photoId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  const [selectedId] = selected
  const selectedIsCover = selected.size === 1 && selectedId === album?.coverPhotoId

  function toggleBestCut() {
    updateAlbum.mutate({ coverPhotoId: selectedIsCover ? null : selectedId }, { onSuccess: toggleSelecting })
  }

  async function addPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = '' // let the same files be picked again after a failure
    if (files.length === 0) return
    const videos = files.filter(isVideoFile)
    const videoBytes = videos.reduce((sum, f) => sum + f.size, 0)
    if (videoBytes >= BIG_VIDEO_BYTES) {
      // Without the usage (offline, storage not set up) the upload just goes ahead.
      const usage = await queryClient.fetchQuery({ queryKey: keys.storage, queryFn: api.storage }).catch(() => null)
      const message = usage && t.storage.bigUpload(videos.length, formatBytes(videoBytes), formatBytes(usage.usedBytes), formatBytes(usage.freeBytes))
      if (message && !(await confirm({ title: t.storage.bigUploadTitle, message, confirmLabel: t.common.proceed }))) return
    }
    uploadPhotos.mutate(files)
  }

  /** Saves the album's files to this device: the selected ones, or all of them. */
  async function saveToDevice(photoIds?: Set<number>) {
    const total = photoIds?.size ?? album?.photos.length ?? 0
    const message = t.albums.confirmSaveBody[saveMode()]
    if (total === 0 || !(await confirm({ title: t.albums.confirmSave(total), message, confirmLabel: t.common.save }))) return
    // Straight from the confirm tap: a folder picker needs it.
    await saver.start(async () => (await loadDownloads()).filter((f) => !photoIds || photoIds.has(f.photoId)))
  }

  function changeSort(next: SortOrder) {
    setSort(next)
    remember(SORT_STORAGE_KEY, next)
  }

  function flipDirection() {
    const next = direction === 'ASC' ? 'DESC' : 'ASC'
    setDirection(next)
    remember(DIRECTION_STORAGE_KEY, next)
  }

  async function removeSelected() {
    if (!(await confirm({ title: t.albums.confirmDelete(selected.size), confirmLabel: t.common.delete, danger: true }))) return
    deletePhotos.mutate([...selected], { onSuccess: toggleSelecting })
  }

  const header = (
    <SubHeader
      eyebrow={t.albums.detailEyebrow}
      title={t.albums.detailTitle}
      fallback="/albums"
      action={
        album && (
          // Desktop puts the edit button in the album card instead.
          <div className="md:hidden">
            <HeaderAction onClick={() => setEditing(true)}>{t.common.edit}</HeaderAction>
          </div>
        )
      }
    />
  )

  if (!album) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <QueryState isLoading={isLoading} error={error} />
      </div>
    )
  }

  const counts = {
    ALL: album.photos.length,
    PHOTO: album.photos.filter((p) => p.mediaType === 'PHOTO').length,
    VIDEO: album.photos.filter((p) => p.mediaType === 'VIDEO').length,
  }
  const filtered = filter === 'ALL' ? album.photos : album.photos.filter((p) => p.mediaType === filter)
  const shown = sortItems(filtered, sort, direction)
  const start = parseDateOnly(album.albumDate)
  const end = parseDateOnly(album.albumEndDate)
  const days = daysBetween(start, end) + 1
  const dayHeading = (d: Date, label: string) => t.calendar.dayHeading(label, t.weekdays[d.getDay()]!)
  // One day: `2026.09.10 (목)`. A trip: `2026.09.10 (목) ~ 09.12 (토) · 2박 3일`. A month: `2026년 10월 · 한 달`.
  const period = album.monthly
    ? `${t.dates.yearMonth(start)} · ${t.albums.wholeMonth}`
    : days === 1
      ? dayHeading(start, formatDotted(start))
      : `${dayHeading(start, formatDotted(start))} ~ ${dayHeading(end, start.getFullYear() === end.getFullYear() ? formatMonthDay(end) : formatDotted(end))} · ${t.albums.tripLength(days - 1, days)}`
  const onlyPlace = album.places.length === 1 ? album.places[0] : undefined
  const actionError = updateAlbum.error ?? deletePhotos.error ?? toFront.error ?? movePhotos.error ?? saveError

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:mx-auto md:w-full md:max-w-[1240px] md:px-5">
      {header}
      {/* Album info first (on desktop a wide card with the best cut beside it), then the photos below. */}
      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3 md:gap-4 md:pb-10">
        <section className="flex gap-6 ui-box retro:m-1 retro:bg-surface retro:p-3 md:rounded-2xl md:border-[1.5px] md:border-card-border md:bg-surface md:p-5">
          {album.coverPhoto?.thumbnailUrl && (
            <div className="relative hidden aspect-[4/3] w-[260px] shrink-0 overflow-hidden rounded-xl bg-sand-soft retro:pixel-outline md:block xl:w-[300px]">
              <img src={album.coverPhoto.thumbnailUrl} alt={t.albums.bestCut} className="size-full object-cover" />
              {album.coverPhotoId !== null && (
                <span className="absolute top-2 left-2 flex items-center gap-0.5 rounded-md bg-amber-soft px-1.5 py-[3px] text-[11px] font-bold text-amber-strong retro:top-1 retro:left-1 retro:bg-amber retro:px-1 retro:py-0 retro:font-normal retro:text-ink">
                  <Star size={10} strokeWidth={2} /> {t.albums.bestCut}
                </span>
              )}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-[5px]">
              <div className="flex items-start gap-3">
                <h2 className="min-w-0 flex-1 font-display text-[20px] leading-[1.38] md:text-[26px]">
                  {albumHeading(album, t.dates.yearMonth)}
                </h2>
                <div className="hidden shrink-0 md:block">
                  <HeaderAction onClick={() => setEditing(true)}>{t.albums.editAlbum}</HeaderAction>
                </div>
              </div>
              <p className="text-[12px] leading-normal text-muted">
                {period} · {t.albums.mediaCount(counts.PHOTO, counts.VIDEO)}
              </p>
              {album.places.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {album.places.map((place) => (
                    <span key={place.id} className="ui-badge flex items-center gap-1 py-[3px]">
                      <MapPin size={12} strokeWidth={1.75} /> {place.name}
                    </span>
                  ))}
                  {/* One place: show where it is. Several: the names are enough. */}
                  {onlyPlace?.address && <span className="ui-badge bg-sand-soft py-[3px] text-ink retro:bg-amber-soft retro:text-amber-ink">{onlyPlace.address}</span>}
                </div>
              )}
            </div>

            {album.highlightNote && (
              <div className="flex flex-col gap-1 rounded-xl bg-amber-soft p-3 retro:bg-coral-soft retro:px-2.5 retro:py-2">
                <span className="flex items-center gap-1 text-[12px] font-bold text-amber-strong retro:text-[11px] retro:font-normal retro:text-coral-strong">
                  <Star size={12} strokeWidth={1.75} className="retro:hidden" /> {t.common.mustSee}
                </span>
                <p className="ui-prose text-[13px] leading-normal text-amber-ink retro:text-ink">{album.highlightNote}</p>
              </div>
            )}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-3 md:pt-3">

        <div className="flex items-center justify-between">
          <h3 className="font-display text-[18px]">{album.monthly ? t.albums.momentsMonthly : t.albums.moments}</h3>
          <div className="flex gap-2">
            {album.photos.length > 0 && !selecting && (
              <button
                type="button"
                onClick={() => saveToDevice()}
                disabled={saveProgress !== null}
                className="ui-btn-thin h-8 rounded-full bg-surface px-3 text-[12px] font-semibold text-brand-text disabled:opacity-50 retro:text-brand-text"
              >
                {saveProgress ? t.albums.saveStarting(saveProgress.done, saveProgress.total) : t.albums.saveAll}
              </button>
            )}
            {album.photos.length > 0 && (
              <button
                type="button"
                onClick={toggleSelecting}
                className="ui-btn-thin h-8 rounded-full bg-surface px-3 text-[12px] font-semibold text-brand-text retro:text-brand-text"
              >
                {selecting ? t.albums.done : t.albums.select}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploadPhotos.isPending || selecting}
              className="ui-btn-thin h-8 rounded-full bg-brand-strong px-3 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {uploadPhotos.progress
                ? t.albums.uploading(uploadPhotos.progress.done, uploadPhotos.progress.total, uploadPhotos.progress.percent)
                : t.albums.addPhotos}
            </button>
          </div>
          <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={addPhotos} />
        </div>

        {uploadPhotos.error && <p className="text-[12px] text-coral-strong">{errorMessage(uploadPhotos.error, t)}</p>}
        {!selecting && saveError && <p className="text-[12px] text-coral-strong">{errorMessage(saveError, t)}</p>}
        <SaveReadyBar saver={saver} />
        {uploadPhotos.data && uploadPhotos.data.failed > 0 && (
          <p className="text-[12px] text-coral-strong">{t.albums.uploadFailed(uploadPhotos.data.failed)}</p>
        )}
        {movePhotos.data && movePhotos.data.skipped > 0 && (
          <p className="text-[12px] text-muted">{t.albums.moveSkipped(movePhotos.data.skipped)}</p>
        )}
        {uploadPhotos.data && uploadPhotos.data.skipped > 0 && (
          <p className="text-[12px] text-muted">{t.albums.uploadSkipped(uploadPhotos.data.skipped)}</p>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {album.photos.length > 0 && (
          <div className="ui-seg flex h-10 shrink-0 rounded-2xl bg-surface p-1 retro:mt-1 md:w-[380px]" role="tablist">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => {
                  setFilter(value)
                  setSelected(new Set()) // don't keep hidden items selected for deletion
                }}
                className={`ui-seg-option flex-1 rounded-xl text-[13px] leading-normal font-semibold retro:text-[12px] ${
                  filter === value ? 'bg-brand-strong text-white' : 'text-ink'
                }`}
              >
                {t.albums.filter[value](counts[value])}
              </button>
            ))}
          </div>
        )}

        {album.photos.length > 1 && (
          <div className="flex items-center justify-end gap-1 text-[12px]" role="group" aria-label={t.albums.sortLabel}>
            {SORTS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={sort === value}
                onClick={() => changeSort(value)}
                className={`ui-pop ui-hit-y h-7 rounded-full px-2.5 font-semibold ${sort === value ? 'bg-brand-soft text-brand-text' : 'text-muted'}`}
              >
                {t.albums.sort[value]}
              </button>
            ))}
            <span className="mx-0.5 h-3.5 w-px bg-sand" aria-hidden="true" />
            <button
              type="button"
              onClick={flipDirection}
              aria-label={t.albums.directionLabel(t.albums.direction[direction])}
              className="ui-hit-y flex h-7 items-center gap-1 rounded-full px-2.5 font-semibold text-muted"
            >
              {direction === 'ASC' ? <ArrowUp size={12} strokeWidth={1.75} /> : <ArrowDown size={12} strokeWidth={1.75} />} {t.albums.direction[direction]}
            </button>
          </div>
        )}
        </div>

        {shown.length === 0 ? (
          <p className="ui-empty rounded-2xl bg-surface/60 py-10 text-center text-[13px] text-muted">
            {filter === 'ALL' ? t.albums.empty : t.albums.emptyFilter[filter]}
            <br />
            <span className="text-[11px]">{t.albums.emptyHint}</span>
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 retro:p-0.5 md:grid-cols-5 xl:grid-cols-7">
            {shown.map((photo, i) => {
              const isSelected = selected.has(photo.id)
              return (
                <button
                  key={photo.id}
                  type="button"
                  data-photo-id={photo.id}
                  onClick={() => (selecting ? toggle(photo.id) : setViewing(i))}
                  aria-pressed={selecting ? isSelected : undefined}
                  style={riseDelay(i)}
                  className={`relative h-[116px] overflow-hidden rounded-xl bg-sand-soft retro:pixel-outline retro:pixel-thin md:aspect-square md:h-auto md:hover:opacity-90 ${RISE_IN} ${
                    isSelected ? 'ring-3 ring-brand ring-offset-1 retro:z-10 retro:[--pixel-border:var(--color-brand)] retro:[--pixel:3px]' : 'retro:[--pixel-border:var(--color-handle)]'
                  }`}
                >
                  <GridPhoto photo={photo} />
                  {photo.mediaType === 'VIDEO' && (
                    <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-night/70 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                      <Play size={9} strokeWidth={2} />
                      {photo.durationSec !== null && formatDuration(photo.durationSec)}
                    </span>
                  )}
                  {photo.id === album.coverPhotoId && (
                    <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-md bg-amber-soft px-1.5 py-[3px] text-[11px] font-bold text-amber-strong retro:top-1 retro:left-1 retro:bg-amber retro:px-1 retro:py-0 retro:font-normal retro:text-ink">
                      <Star size={10} strokeWidth={2} /> {t.albums.bestCut}
                    </span>
                  )}
                  {!selecting && ((photo.comments?.length ?? 0) > 0 || (photo.reactions?.length ?? 0) > 0) && (
                    <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-night/70 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white tabular-nums">
                      {photo.reactions?.[0]?.emoji ?? <MessageCircle size={10} strokeWidth={2} />}
                      {(photo.comments?.length ?? 0) > 0 && photo.comments!.length}
                    </span>
                  )}
                  {selecting && (
                    <span
                      className={`absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white text-white ${
                        isSelected ? 'bg-brand-strong' : 'bg-night/30'
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={2.5} />}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        </div>
      </div>

      {selecting && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-sand bg-surface px-5 py-3 retro:border-t-3 retro:border-ink">
          {actionError && <p className="text-[12px] text-coral-strong">{errorMessage(actionError, t)}</p>}
          {album.coverPhotoId === null && <p className="text-[11px] text-muted">{t.albums.bestCutHint}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={toggleBestCut}
              disabled={selected.size !== 1 || updateAlbum.isPending}
              className="ui-btn-thin h-11 flex-1 rounded-2xl bg-amber-soft text-[14px] font-semibold text-amber-strong disabled:opacity-40 retro:text-[13px]"
            >
              {selectedIsCover ? t.albums.unsetBestCut : t.albums.makeBestCut}
            </button>
            <button
              type="button"
              onClick={() => saveToDevice(selected)}
              disabled={selected.size === 0 || saveProgress !== null}
              className="ui-btn-thin h-11 flex-1 rounded-2xl bg-brand-soft text-[14px] font-semibold text-brand-text disabled:opacity-40 retro:text-[13px]"
            >
              {saveProgress ? t.albums.saveStarting(saveProgress.done, saveProgress.total) : t.albums.save}
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={selected.size === 0 || deletePhotos.isPending}
              className="ui-btn-thin h-11 flex-1 rounded-2xl bg-coral-soft text-[14px] font-semibold text-coral-strong disabled:opacity-40 retro:text-[13px]"
            >
              {t.albums.delete}
              {selected.size > 0 && ` (${selected.size})`}
            </button>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                // Shown in album order, where the move is visible.
                changeSort('UPLOADED')
                toFront.mutate({ order: album.photos.map((p) => p.id), photoIds: selected }, { onSuccess: toggleSelecting })
              }}
              disabled={selected.size === 0 || toFront.isPending}
              className="ui-btn-thin h-11 flex-1 rounded-2xl bg-sand-soft text-[14px] font-semibold disabled:opacity-40 retro:text-[13px]"
            >
              {t.albums.toFront}
            </button>
            <button
              type="button"
              onClick={() => setMoving(true)}
              disabled={selected.size === 0 || movePhotos.isPending}
              className="ui-btn-thin h-11 flex-1 rounded-2xl bg-sand-soft text-[14px] font-semibold disabled:opacity-40 retro:text-[13px]"
            >
              {t.albums.moveToAlbum}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>{editing && <EditAlbumSheet album={album} onClose={() => setEditing(false)} />}</AnimatePresence>
      <AnimatePresence>
        {moving && (
          <MovePhotosSheet
            currentId={album.id}
            count={selected.size}
            busy={movePhotos.isPending}
            onClose={() => setMoving(false)}
            onPick={(targetId) =>
              movePhotos.mutate(
                { photoIds: [...selected], targetId },
                {
                  onSuccess: () => {
                    setMoving(false)
                    toggleSelecting()
                  },
                },
              )
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewing !== null && (
          <PhotoViewer
            albumId={id}
            photos={shown}
            startIndex={viewing}
            coverPhotoId={album.coverPhotoId}
            onSetCover={(coverPhotoId) => updateAlbum.mutate({ coverPhotoId })}
            coverPending={updateAlbum.isPending}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Grid image (a video's first frame); a photo whose file is gone says so, so it can still be selected
 * and deleted. A video without a captured frame gets a plain placeholder.
 */
function GridPhoto({ photo }: { photo: Photo }) {
  const t = useT()
  const src = photo.thumbnailUrl
  const { failed, onError } = useImageFailed(src)
  if (src && !failed) return <img src={src} alt="" loading="lazy" onError={onError} className="size-full object-cover" />
  if (photo.mediaType === 'VIDEO' && !src) {
    return (
      <span className="flex size-full flex-col items-center justify-center gap-1 bg-night/80 text-[11px] text-white/80">
        <Video size={22} strokeWidth={1.5} />
        {t.albums.video}
      </span>
    )
  }
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px] leading-snug text-muted">
      <TriangleAlert size={18} strokeWidth={1.5} />
      {t.albums.missingPhoto}
    </span>
  )
}
