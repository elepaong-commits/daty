import { useRef, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router'
import { QueryState } from '../../components/Field'
import { HeaderAction, SubHeader } from '../../components/SubHeader'
import { errorMessage } from '../../lib/api'
import { formatDotted, formatSlashDay, parseDateOnly } from '../../lib/dates'
import { useAlbum, useDeletePhotos, useUpdateAlbum, useUploadPhotos } from '../../lib/queries'
import { useT } from '../../lib/i18n'

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

  function makeBestCut() {
    const [photoId] = selected
    updateAlbum.mutate({ coverPhotoId: photoId }, { onSuccess: toggleSelecting })
  }

  function addPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = '' // let the same files be picked again after a failure
    if (files.length > 0) uploadPhotos.mutate(files)
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
      action={
        album && album.photoCount > 0 ? (
          <HeaderAction onClick={toggleSelecting}>{selecting ? t.albums.done : t.albums.select}</HeaderAction>
        ) : undefined
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
            {formatDotted(date)} · {t.common.photos(album.photoCount)}
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
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploadPhotos.isPending || selecting}
            className="h-8 rounded-full bg-brand px-3 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {uploadPhotos.progress
              ? t.albums.uploading(uploadPhotos.progress.done, uploadPhotos.progress.total)
              : t.albums.addPhotos}
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
        </div>

        {uploadPhotos.error && <p className="text-[12px] text-coral-strong">{errorMessage(uploadPhotos.error, t)}</p>}
        {uploadPhotos.data && uploadPhotos.data.failed > 0 && (
          <p className="text-[12px] text-coral-strong">{t.albums.uploadFailed(uploadPhotos.data.failed)}</p>
        )}

        {album.photos.length === 0 ? (
          <p className="rounded-2xl bg-white/60 py-10 text-center text-[13px] text-muted">
            {t.albums.empty}
            <br />
            <span className="text-[11px]">{t.albums.emptyHint}</span>
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {album.photos.map((photo) => {
              const isSelected = selected.has(photo.id)
              return (
                <button
                  key={photo.id}
                  type="button"
                  disabled={!selecting}
                  onClick={() => toggle(photo.id)}
                  aria-pressed={selecting ? isSelected : undefined}
                  className={`relative h-[116px] overflow-hidden rounded-xl bg-sand-soft ${isSelected ? 'ring-3 ring-brand ring-offset-1' : ''}`}
                >
                  {photo.imageUrl && <img src={photo.imageUrl} alt="" loading="lazy" className="size-full object-cover" />}
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
          <div className="flex gap-3">
            <button
              type="button"
              onClick={makeBestCut}
              disabled={selected.size !== 1 || updateAlbum.isPending}
              className="h-11 flex-1 rounded-2xl bg-amber-soft text-[14px] font-semibold text-amber-strong disabled:opacity-40"
            >
              {t.albums.makeBestCut}
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
    </div>
  )
}
