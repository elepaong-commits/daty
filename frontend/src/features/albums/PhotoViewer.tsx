import { TriangleAlert, X } from 'lucide-react'
import { useAnimate, usePresence, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatDotted, toTimeInput } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { enterSpring, exitTween, settleTween } from '../../lib/motion'
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

/**
 * Full-screen viewer; swipe (or arrows/keys) between the album's photos and videos. A photo zooms out of its
 * grid tile (`data-photo-id`) on open and back into the tile of the one being shown on close; render it inside
 * `AnimatePresence` for the closing half.
 */
export function PhotoViewer({ photos, startIndex, coverPhotoId, onSetCover, coverPending, onClose }: Props) {
  const t = useT()
  const strip = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const flyer = useRef<HTMLDivElement>(null)
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [isPresent, safeToRemove] = usePresence()
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(startIndex)
  const photo = photos[Math.min(index, photos.length - 1)]

  // Open on the tapped photo without animating through the ones before it, zooming it out of its tile.
  useLayoutEffect(() => {
    const el = strip.current
    if (el) el.scrollLeft = startIndex * el.clientWidth

    animate('[data-viewer-fade]', { opacity: [0, 1] }, { duration: 0.2 })
    const tile = reduceMotion ? null : tileFor(photos[startIndex])
    if (!tile || !el || !stage.current || !flyer.current) {
      animate(stage.current!, { opacity: [0, 1], scale: [0.96, 1] }, enterSpring)
      return
    }
    const target = containRect(el.getBoundingClientRect(), tile.aspect)
    stage.current.style.opacity = '0'
    tile.img.style.visibility = 'hidden'
    flyer.current.style.display = 'block'
    animate(flyer.current, { ...between(tile.img.getBoundingClientRect(), target), borderRadius: [TILE_RADIUS, 0] }, enterSpring).then(() => {
      stage.current?.style.removeProperty('opacity')
      tile.img.style.removeProperty('visibility')
      if (flyer.current) flyer.current.style.display = 'none'
    })
  }, [startIndex]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once, when the viewer opens

  // Closing: shrink the photo on screen back into its tile, or just fade when that tile isn't showing.
  useEffect(() => {
    if (isPresent) return
    const fade = animate('[data-viewer-fade]', { opacity: 0 }, exitTween)
    const tile = reduceMotion ? null : tileFor(photo)
    const el = strip.current
    if (!tile || !el || !stage.current || !flyer.current) {
      Promise.all([fade, animate(stage.current!, { opacity: 0, scale: 0.96 }, exitTween)]).then(safeToRemove)
      return
    }
    const from = containRect(el.getBoundingClientRect(), tile.aspect)
    stage.current.style.opacity = '0'
    tile.img.style.visibility = 'hidden'
    flyer.current.style.display = 'block'
    const shrink = animate(flyer.current, { ...between(from, tile.img.getBoundingClientRect()), borderRadius: [0, TILE_RADIUS] }, settleTween)
    Promise.all([fade, shrink]).then(() => {
      tile.img.style.removeProperty('visibility')
      safeToRemove()
    })
  }, [isPresent]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once, when the viewer closes

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
    <div
      ref={scope}
      className={`absolute inset-0 z-50 flex flex-col text-white lg:fixed ${isPresent ? '' : 'pointer-events-none'}`}
      role="dialog"
      aria-modal="true"
      aria-label={t.albums.viewer}
    >
      <div data-viewer-fade className="absolute inset-0 bg-ink" />
      <div data-viewer-fade className="relative flex shrink-0 items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-[13px] font-semibold tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full bg-white/15"
          aria-label={t.common.close}
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div ref={stage} className="relative min-h-0 flex-1">
        <div
          ref={strip}
          onScroll={onScroll}
          className="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto overscroll-contain"
        >
          {photos.map((p, i) => (
            <div key={p.id} className="flex size-full shrink-0 snap-center items-center justify-center">
              {p.mediaType === 'VIDEO' ? (
                <ViewerVideo src={p.imageUrl} poster={p.thumbnailUrl} active={i === index} />
              ) : (
                // Neighbours load right away so swiping doesn't show a blank frame.
                <ViewerPhoto src={p.imageUrl} thumb={p.thumbnailUrl} eager={Math.abs(i - index) <= 1} />
              )}
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

      {/* The shown photo's thumbnail, flown between its grid tile and the viewer while opening and closing. */}
      <div ref={flyer} className="pointer-events-none fixed hidden overflow-hidden">
        {photo?.thumbnailUrl && <img src={photo.thumbnailUrl} alt="" className="size-full object-cover" />}
      </div>

      <div data-viewer-fade className="relative flex min-h-12 shrink-0 items-center justify-between gap-2 px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] text-[12px] text-white/80">
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

// Grid tiles are `rounded-xl`.
const TILE_RADIUS = 12

/** A photo's grid image and its aspect ratio, when that tile is on screen with its thumbnail loaded. */
function tileFor(photo: Photo | undefined) {
  if (photo?.mediaType !== 'PHOTO' || !photo.thumbnailUrl) return null
  const img = document.querySelector<HTMLImageElement>(`[data-photo-id="${photo.id}"] img`)
  if (!img?.naturalWidth) return null
  const rect = img.getBoundingClientRect()
  if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.width === 0) return null
  return { img, aspect: img.naturalWidth / img.naturalHeight }
}

type Box = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

/** Where an image of this aspect ratio sits when fitted (`object-contain`) inside the area. */
function containRect(area: DOMRect, aspect: number): Box {
  const width = Math.min(area.width, area.height * aspect)
  const height = width / aspect
  return { left: area.left + (area.width - width) / 2, top: area.top + (area.height - height) / 2, width, height }
}

function between(from: Box, to: Box) {
  return { left: [from.left, to.left], top: [from.top, to.top], width: [from.width, to.width], height: [from.height, to.height] }
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

/** Plays in place; swiping to another item pauses it. Only the open one fetches more than its poster. */
function ViewerVideo({ src, poster, active }: { src: string | null; poster: string | null; active: boolean }) {
  const t = useT()
  const ref = useRef<HTMLVideoElement>(null)
  const { failed, onError } = useImageFailed(src)

  useEffect(() => {
    if (!active) ref.current?.pause()
  }, [active])

  if (src && !failed) {
    return (
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        controls
        playsInline
        preload={active ? 'metadata' : 'none'}
        onError={onError}
        className="max-h-full max-w-full"
      />
    )
  }
  return (
    <span className="flex flex-col items-center gap-1 text-[12px] text-white/70">
      <TriangleAlert size={24} strokeWidth={1.5} />
      {t.albums.missingVideo}
    </span>
  )
}

/** The full image over its thumbnail, which is already cached from the grid and shows while the full one loads. */
function ViewerPhoto({ src, thumb, eager }: { src: string | null; thumb: string | null; eager: boolean }) {
  const t = useT()
  const { failed, onError } = useImageFailed(src)
  if (src && !failed) {
    return (
      <div className="relative size-full select-none">
        {thumb && thumb !== src && <img src={thumb} alt="" draggable={false} className="absolute inset-0 size-full object-contain" />}
        <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} onError={onError} draggable={false} className="absolute inset-0 size-full object-contain" />
      </div>
    )
  }
  return (
    <span className="flex flex-col items-center gap-1 text-[12px] text-white/70">
      <TriangleAlert size={24} strokeWidth={1.5} />
      {t.albums.missingPhoto}
    </span>
  )
}
