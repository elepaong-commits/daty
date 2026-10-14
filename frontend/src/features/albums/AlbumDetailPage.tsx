import { useRef, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router'
import { QueryState } from '../../components/Field'
import { HeaderAction, SubHeader } from '../../components/SubHeader'
import { errorMessage } from '../../lib/api'
import { formatDotted, formatDuration, formatSlashDay, parseDateOnly } from '../../lib/dates'
import { useAlbum, useDeletePhotos, useUpdateAlbum, useUploadPhotos } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import type { MediaType, Photo } from '../../lib/types'
import { useImageFailed } from '../../lib/useImageFailed'
import { EditAlbumSheet } from './EditAlbumSheet'
import { PhotoViewer } from './PhotoViewer'

type MediaFilter = 'ALL' | MediaType
const FILTERS: MediaFilter[] = ['ALL', 'PHOTO', 'VIDEO']

// Upload order is `displayOrder`; taken order puts items without a capture time last, in upload order.
type SortOrder = 'UPLOADED' | 'TAKEN'
const SORTS: SortOrder[] = ['UPLOADED', 'TAKEN']
const SORT_STORAGE_KEY = 'daty.albumSort'

const byTakenAt = (a: Photo, b: Photo) =>
  (a.takenAt ?? '\uffff').localeCompare(b.takenAt ?? '\uffff') || a.displayOrder - b.displayOrder

/** The viewer's last pick, remembered on this device. */
function savedSort(): SortOrder {
  try {
    return localStorage.getItem(SORT_STORAGE_KEY) === 'TAKEN' ? 'TAKEN' : 'UPLOADED'
  } catch {
    return 'UPLOADED'
  }
}

export function AlbumDetailPage() {
  const id = Number(useParams().id)
  const { data: album, isLoading, error } = useAlbum(id)
  const t = useT()
  const updateAlbum = useUpdateAlbum(id)
  const deletePhotos = useDeletePhotos(id)
  const uploadPhotos = useUploadPhotos(id)
  const fileInput = useRef<HTMLInputElement>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState<MediaFilter>('ALL')
  const [sort, setSort] = useState<SortOrder>(savedSort)
  const [viewing, setViewing] = useState<number | null>(null) // index in `shown` of the item open in the viewer

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

  function addPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = '' // let the same files be picked again after a failure
    if (files.length > 0) uploadPhotos.mutate(files)
  }

  function changeSort(next: SortOrder) {
    setSort(next)
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next)
    } catch {
      // Private mode etc.: the order just isn't remembered.
    }
  }

  function removeSelected() {
    if (!window.confirm(t.albums.confirmDelete(selected.size))) return
    deletePhotos.mutate([...selected], { onSuccess: toggleSelecting })
  }

  const header = (
    <SubHeader
      eyebrow={t.albums.detailEyebrow}
      title={t.albums.detailTitle}
      fallback="/albums"
      action={album && <HeaderAction onClick={() => setEditing(true)}>{t.common.edit}</HeaderAction>}
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
  // The API already returns upload order.
  const shown = sort === 'TAKEN' ? filtered.toSorted(byTakenAt) : filtered
  const date = parseDateOnly(album.albumDate)
  const firstPlace = album.places[0]
  const actionError = updateAlbum.error ?? deletePhotos.error

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {header}
      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3">
        <div className="flex flex-col gap-[5px]">
          <h2 className="font-display text-[20px] leading-[1.38]">
            {formatSlashDay(date)} · {album.title}
          </h2>
          <p className="text-[12px] leading-normal text-muted">
            {formatDotted(date)} · {t.albums.mediaCount(counts.PHOTO, counts.VIDEO)}
          </p>
          {firstPlace && (
            <div className="flex gap-1.5 text-[11px] font-semibold">
              <span className="rounded-md bg-brand-soft px-2 py-[3px] text-brand-strong">📍 {firstPlace.name}</span>
              {firstPlace.address && <span className="rounded-md bg-sand-soft px-2 py-[3px]">{firstPlace.address}</span>}
            </div>
          )}
        </div>

        {album.highlightNote && (
          <div className="flex flex-col gap-1 rounded-xl bg-amber-soft p-3">
            <span className="text-[12px] font-bold text-amber-strong">⭐ {t.common.mustSee}</span>
            <p className="text-[13px] leading-normal text-amber-ink">{album.highlightNote}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="font-display text-[18px]">{t.albums.moments}</h3>
          <div className="flex gap-2">
            {album.photos.length > 0 && (
              <button
                type="button"
                onClick={toggleSelecting}
                className="h-8 rounded-full bg-white px-3 text-[12px] font-semibold text-brand"
              >
                {selecting ? t.albums.done : t.albums.select}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploadPhotos.isPending || selecting}
              className="h-8 rounded-full bg-brand px-3 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {uploadPhotos.progress
                ? t.albums.uploading(uploadPhotos.progress.done, uploadPhotos.progress.total, uploadPhotos.progress.percent)
                : t.albums.addPhotos}
            </button>
          </div>
          <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={addPhotos} />
        </div>

        {uploadPhotos.error && <p className="text-[12px] text-coral-strong">{errorMessage(uploadPhotos.error, t)}</p>}
        {uploadPhotos.data && uploadPhotos.data.failed > 0 && (
          <p className="text-[12px] text-coral-strong">{t.albums.uploadFailed(uploadPhotos.data.failed)}</p>
        )}

        {album.photos.length > 0 && (
          <div className="flex h-10 shrink-0 rounded-2xl bg-white p-1" role="tablist">
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
                className={`flex-1 rounded-xl text-[13px] leading-normal font-semibold ${filter === value ? 'bg-brand text-white' : 'text-ink'}`}
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
                className={`h-7 rounded-full px-2.5 font-semibold ${sort === value ? 'bg-brand-soft text-brand-strong' : 'text-muted'}`}
              >
                {t.albums.sort[value]}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="rounded-2xl bg-white/60 py-10 text-center text-[13px] text-muted">
            {filter === 'ALL' ? t.albums.empty : t.albums.emptyFilter[filter]}
            <br />
            <span className="text-[11px]">{t.albums.emptyHint}</span>
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {shown.map((photo, i) => {
              const isSelected = selected.has(photo.id)
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => (selecting ? toggle(photo.id) : setViewing(i))}
                  aria-pressed={selecting ? isSelected : undefined}
                  className={`relative h-[116px] overflow-hidden rounded-xl bg-sand-soft ${isSelected ? 'ring-3 ring-brand ring-offset-1' : ''}`}
                >
                  <GridPhoto photo={photo} />
                  {photo.mediaType === 'VIDEO' && (
                    <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                      ▶{photo.durationSec !== null && ` ${formatDuration(photo.durationSec)}`}
                    </span>
                  )}
                  {photo.id === album.coverPhotoId && (
                    <span className="absolute top-1.5 left-1.5 rounded-md bg-amber-soft px-1.5 py-[3px] text-[10px] font-bold text-amber-strong">
                      {t.albums.bestCut}
                    </span>
                  )}
                  {selecting && (
                    <span
                      className={`absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white text-[11px] text-white ${
                        isSelected ? 'bg-brand' : 'bg-ink/30'
                      }`}
                    >
                      {isSelected && '✓'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selecting && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-sand bg-white px-5 py-3">
          {actionError && <p className="text-[12px] text-coral-strong">{errorMessage(actionError, t)}</p>}
          {album.coverPhotoId === null && <p className="text-[11px] text-muted">{t.albums.bestCutHint}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={toggleBestCut}
              disabled={selected.size !== 1 || updateAlbum.isPending}
              className="h-11 flex-1 rounded-2xl bg-amber-soft text-[14px] font-semibold text-amber-strong disabled:opacity-40"
            >
              {selectedIsCover ? t.albums.unsetBestCut : t.albums.makeBestCut}
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={selected.size === 0 || deletePhotos.isPending}
              className="h-11 flex-1 rounded-2xl bg-coral-soft text-[14px] font-semibold text-coral-strong disabled:opacity-40"
            >
              {t.albums.delete}
              {selected.size > 0 && ` (${selected.size})`}
            </button>
          </div>
        </div>
      )}

      {editing && <EditAlbumSheet album={album} onClose={() => setEditing(false)} />}
      {viewing !== null && (
        <PhotoViewer
          photos={shown}
          startIndex={viewing}
          coverPhotoId={album.coverPhotoId}
          onSetCover={(coverPhotoId) => updateAlbum.mutate({ coverPhotoId })}
          coverPending={updateAlbum.isPending}
          onClose={() => setViewing(null)}
        />
      )}
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
      <span className="flex size-full flex-col items-center justify-center gap-1 bg-ink/80 text-[10px] text-white/80">
        <span className="text-[22px]">🎬</span>
        {t.albums.video}
      </span>
    )
  }
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] leading-snug text-muted">
      <span className="text-[18px]">⚠️</span>
      {t.albums.missingPhoto}
    </span>
  )
}
