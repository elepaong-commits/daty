import { useState } from 'react'
import { useParams } from 'react-router'
import { QueryState } from '../../components/Field'
import { HeaderAction, SubHeader } from '../../components/SubHeader'
import { errorMessage } from '../../lib/api'
import { formatDotted, formatSlashDay, parseDateOnly } from '../../lib/dates'
import { useAlbum, useDeletePhotos, useUpdateAlbum } from '../../lib/queries'

export function AlbumDetailPage() {
  const id = Number(useParams().id)
  const { data: album, isLoading, error } = useAlbum(id)
  const updateAlbum = useUpdateAlbum(id)
  const deletePhotos = useDeletePhotos(id)
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

  function removeSelected() {
    if (!window.confirm(`사진 ${selected.size}장을 삭제할까요?`)) return
    deletePhotos.mutate([...selected], { onSuccess: toggleSelecting })
  }

  const header = (
    <SubHeader
      eyebrow="추억 갤러리 · 앨범 상세"
      title="우리의 데이트 앨범"
      fallback="/albums"
      action={
        album && album.photoCount > 0 ? (
          <HeaderAction onClick={toggleSelecting}>{selecting ? '완료' : '선택'}</HeaderAction>
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
            {formatDotted(date)} · 사진 {album.photoCount}장
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
            <span className="text-[12px] font-bold text-amber-strong">⭐ 꼭 봐야 할 포인트</span>
            <p className="text-[13px] leading-normal text-amber-ink">{album.highlightNote}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="font-display text-[18px]">그날의 순간들</h3>
          <button
            type="button"
            disabled
            title="사진 올리기는 곧 추가돼요"
            className="h-8 rounded-full bg-brand px-3 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            + 사진 추가
          </button>
        </div>

        {album.photos.length === 0 ? (
          <p className="rounded-2xl bg-white/60 py-10 text-center text-[13px] text-muted">
            아직 사진이 없어요
            <br />
            <span className="text-[11px]">사진 올리기는 곧 추가돼요</span>
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
                  className={`relative h-[116px] overflow-hidden rounded-xl ${isSelected ? 'ring-3 ring-brand ring-offset-1' : ''}`}
                >
                  <img src={photo.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                  {photo.id === album.coverPhotoId && (
                    <span className="absolute top-1.5 left-1.5 rounded-md bg-amber-soft px-1.5 py-[3px] text-[10px] font-bold text-amber-strong">
                      ★ 베스트 컷
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
          {actionError && <p className="text-[12px] text-coral-strong">{errorMessage(actionError)}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={makeBestCut}
              disabled={selected.size !== 1 || updateAlbum.isPending}
              className="h-11 flex-1 rounded-2xl bg-amber-soft text-[14px] font-semibold text-amber-strong disabled:opacity-40"
            >
              ★ 베스트 컷으로
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={selected.size === 0 || deletePhotos.isPending}
              className="h-11 flex-1 rounded-2xl bg-coral-soft text-[14px] font-semibold text-coral-strong disabled:opacity-40"
            >
              삭제{selected.size > 0 && ` (${selected.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
