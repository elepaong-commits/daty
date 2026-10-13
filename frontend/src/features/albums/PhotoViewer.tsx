import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatDotted, toTimeInput } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import type { Photo } from '../../lib/types'
import { useImageFailed } from '../../lib/useImageFailed'

interface Props {
  photos: Photo[]
  startIndex: number
  coverPhotoId: number | null
  /** Makes the photo the album's best cut, or clears it (`null`). */
  onSetCover: (photoId: number | null) => void
  coverPending: boolean
  onClose: () => void
}

/** Full-screen photo viewer; swipe (or arrows/keys) between the album's photos. */
export function PhotoViewer({ photos, startIndex, coverPhotoId, onSetCover, coverPending, onClose }: Props) {
  const t = useT()
  const strip = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(startIndex)
  const photo = photos[Math.min(index, photos.length - 1)]

  // Open on the tapped photo without animating through the ones before it.
  useLayoutEffect(() => {
    const el = strip.current
    if (el) el.scrollLeft = startIndex * el.clientWidth
  }, [startIndex])

  const go = (next: number) => scrollToPhoto(strip.current, next, photos.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') scrollToPhoto(strip.current, index - 1, photos.length)
      else if (e.key === 'ArrowRight') scrollToPhoto(strip.current, index + 1, photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose])

  function onScroll() {
    const el = strip.current
    if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const takenAt = photo?.takenAt ? new Date(photo.takenAt) : null
  const isCover = photo !== undefined && photo.id === coverPhotoId

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-ink text-white" role="dialog" aria-modal="true" aria-label={t.albums.viewer}>
      <div className="flex shrink-0 items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-[13px] font-semibold tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full bg-white/15 text-[14px]"
          aria-label={t.common.close}
        >
          ✕
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={strip}
          onScroll={onScroll}
          className="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto overscroll-contain"
        >
          {photos.map((p, i) => (
            <div key={p.id} className="flex size-full shrink-0 snap-center items-center justify-center">
              {/* Neighbours load right away so swiping doesn't show a blank frame. */}
              <ViewerPhoto src={p.imageUrl} eager={Math.abs(i - index) <= 1} />
            </div>
          ))}
        </div>
        {index > 0 && (
          <NavButton side="left" label={t.albums.prevPhoto} onClick={() => go(index - 1)}>
            ‹
          </NavButton>
        )}
        {index < photos.length - 1 && (
          <NavButton side="right" label={t.albums.nextPhoto} onClick={() => go(index + 1)}>
            ›
          </NavButton>
        )}
      </div>

      <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] text-[12px] text-white/80">
        <span>{takenAt && `${formatDotted(takenAt)} ${toTimeInput(takenAt)}`}</span>
        {photo && (
          <button
            type="button"
            onClick={() => onSetCover(isCover ? null : photo.id)}
            disabled={coverPending}
            aria-pressed={isCover}
            className={`h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold disabled:opacity-50 ${
              isCover ? 'bg-amber-soft text-amber-strong' : 'bg-white/15 text-white'
            }`}
          >
            {isCover ? t.albums.bestCut : t.albums.makeBestCut}
          </button>
        )}
      </div>
    </div>
  )
}

function scrollToPhoto(strip: HTMLDivElement | null, index: number, count: number) {
  if (strip && index >= 0 && index < count) strip.scrollTo({ left: index * strip.clientWidth, behavior: 'smooth' })
}

function NavButton({ side, label, onClick, children }: { side: 'left' | 'right'; label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 pb-0.5 text-[24px] ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      {children}
    </button>
  )
}

function ViewerPhoto({ src, eager }: { src: string | null; eager: boolean }) {
  const t = useT()
  const { failed, onError } = useImageFailed(src)
  if (src && !failed) {
    return <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} onError={onError} draggable={false} className="max-h-full max-w-full object-contain select-none" />
  }
  return (
    <span className="flex flex-col items-center gap-1 text-[12px] text-white/70">
      <span className="text-[24px]">⚠️</span>
      {t.albums.missingPhoto}
    </span>
  )
}
