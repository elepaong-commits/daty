import { Download, MessageCircle, TriangleAlert, X } from 'lucide-react'
import { useAnimate, usePresence, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { FeedbackPanel } from '../../components/FeedbackPanel'
import { formatDotted, toTimeInput } from '../../lib/dates'
import { useSaveFiles } from '../../lib/useSaveFiles'
import { SaveReadyBar } from './SaveReadyBar'
import { useAlbumDownloads } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import { PixelSprite } from '../../components/PixelSprite'
import { useMotionPreset } from '../../lib/motion'
import { useIsRetro } from '../../lib/theme'
import type { Photo } from '../../lib/types'
import { useImageFailed } from '../../lib/useImageFailed'
import { isTopModal, useDialogFocus } from '../../lib/useDialogFocus'
import { useZoom } from './useZoom'

interface Props {
  albumId: number
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
export function PhotoViewer({ albumId, photos, startIndex, coverPhotoId, onSetCover, coverPending, onClose }: Props) {
  const t = useT()
  const strip = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const flyer = useRef<HTMLDivElement>(null)
  const [scope, animate] = useAnimate<HTMLDivElement>()
  useDialogFocus(onClose, scope)
  const [isPresent, safeToRemove] = usePresence()
  const reduceMotion = useReducedMotion()
  const motion = useMotionPreset()
  const retro = useIsRetro()
  const [index, setIndex] = useState(startIndex)
  const [talking, setTalking] = useState(false) // the reactions and comments panel
  const loadDownloads = useAlbumDownloads(albumId)
  // A zoomed photo pans under the finger instead of the strip swiping to the next one.
  const [zoomed, setZoomed] = useState(false)
  const saver = useSaveFiles(loadDownloads)
  const saving = saver.state.phase !== 'idle'
  const photo = photos[Math.min(index, photos.length - 1)]

  // Open on the tapped photo without animating through the ones before it, zooming it out of its tile.
  useLayoutEffect(() => {
    const el = strip.current
    if (el) el.scrollLeft = startIndex * el.clientWidth

    animate('[data-viewer-fade]', { opacity: [0, 1] }, { duration: 0.2 })
    const tile = reduceMotion ? null : tileFor(photos[startIndex])
    if (!tile || !el || !stage.current || !flyer.current) {
      animate(stage.current!, { opacity: [0, 1], scale: [0.96, 1] }, motion.enter)
      return
    }
    const target = containRect(el.getBoundingClientRect(), tile.aspect)
    stage.current.style.opacity = '0'
    tile.img.style.visibility = 'hidden'
    flyer.current.style.display = 'block'
    animate(flyer.current, { ...between(tile.img.getBoundingClientRect(), target), borderRadius: [motion.tileRadius, 0] }, motion.enter).then(() => {
      stage.current?.style.removeProperty('opacity')
      tile.img.style.removeProperty('visibility')
      if (flyer.current) flyer.current.style.display = 'none'
    })
  }, [startIndex]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once, when the viewer opens

  // Closing: shrink the photo on screen back into its tile, or just fade when that tile isn't showing.
  useEffect(() => {
    if (isPresent) return
    const fade = animate('[data-viewer-fade]', { opacity: 0 }, motion.exit)
    const tile = reduceMotion ? null : tileFor(photo)
    const el = strip.current
    if (!tile || !el || !stage.current || !flyer.current) {
      Promise.all([fade, animate(stage.current!, { opacity: 0, scale: 0.96 }, motion.exit)]).then(safeToRemove)
      return
    }
    const from = containRect(el.getBoundingClientRect(), tile.aspect)
    stage.current.style.opacity = '0'
    tile.img.style.visibility = 'hidden'
    flyer.current.style.display = 'block'
    const shrink = animate(flyer.current, { ...between(from, tile.img.getBoundingClientRect()), borderRadius: [0, motion.tileRadius] }, motion.settle)
    Promise.all([fade, shrink]).then(() => {
      tile.img.style.removeProperty('visibility')
      safeToRemove()
    })
  }, [isPresent]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once, when the viewer closes

  const go = (next: number) => scrollToPhoto(strip.current, next, photos.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Arrow keys move the cursor while a comment is being typed; a confirm on top has them too.
      if (e.target instanceof HTMLInputElement || !isTopModal(scope.current)) return
      if (e.key === 'ArrowLeft') scrollToPhoto(strip.current, index - 1, photos.length)
      else if (e.key === 'ArrowRight') scrollToPhoto(strip.current, index + 1, photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, scope])

  function onScroll() {
    const el = strip.current
    if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const takenAt = photo?.takenAt ? new Date(photo.takenAt) : null
  const isCover = photo !== undefined && photo.id === coverPhotoId
  const feedback = { reactions: photo?.reactions ?? [], comments: photo?.comments ?? [] }
  const reacted = [...new Set(feedback.reactions.map((r) => r.emoji))].join('')

  // A failure leaves nothing saved; the button can simply be pressed again.
  const save = (photoId: number) =>
    saver.start(async () => (await loadDownloads()).filter((f) => f.photoId === photoId), { single: true })

  return (
    <div
      ref={scope}
      tabIndex={-1}
      className={`absolute inset-0 z-50 flex flex-col text-white outline-none lg:fixed ${isPresent ? '' : 'pointer-events-none'}`}
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
          className="flex size-9 items-center justify-center rounded-full bg-white/15 retro:size-8 retro:bg-white retro:pixel-btn retro:pixel-thin"
          aria-label={t.common.close}
        >
          {retro ? <PixelSprite name="close" scale={2} /> : <X size={18} strokeWidth={1.75} />}
        </button>
      </div>
      {saver.state.phase === 'ready' && (
        <div className="relative shrink-0 px-4 pb-2">
          <SaveReadyBar saver={saver} dark />
        </div>
      )}

      <div ref={stage} className="relative min-h-0 flex-1">
        <div
          ref={strip}
          onScroll={onScroll}
          className={`scrollbar-none flex size-full snap-x snap-mandatory overscroll-contain ${zoomed ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
        >
          {photos.map((p, i) => (
            <div key={p.id} className="flex size-full shrink-0 snap-center items-center justify-center">
              {p.mediaType === 'VIDEO' ? (
                <ViewerVideo src={p.imageUrl} poster={p.thumbnailUrl} active={i === index} />
              ) : (
                // Neighbours load right away so swiping doesn't show a blank frame.
                <ViewerPhoto
                  src={p.imageUrl}
                  thumb={p.thumbnailUrl}
                  eager={Math.abs(i - index) <= 1}
                  active={i === index}
                  onZoomChange={setZoomed}
                />
              )}
            </div>
          ))}
        </div>
        {index > 0 && (
          <NavButton side="left" label={t.albums.prevPhoto} onClick={() => go(index - 1)}>
            {retro ? <PixelSprite name="left" scale={3} /> : '‹'}
          </NavButton>
        )}
        {index < photos.length - 1 && (
          <NavButton side="right" label={t.albums.nextPhoto} onClick={() => go(index + 1)}>
            {retro ? <PixelSprite name="right" scale={3} /> : '›'}
          </NavButton>
        )}
      </div>

      {/* The shown photo's thumbnail, flown between its grid tile and the viewer while opening and closing. */}
      <div ref={flyer} className="pointer-events-none fixed hidden overflow-hidden">
        {photo?.thumbnailUrl && <img src={photo.thumbnailUrl} alt="" className="size-full object-cover" />}
      </div>

      {talking && photo && (
        <div data-viewer-fade className="scrollbar-none relative max-h-[45%] shrink-0 overflow-y-auto border-t border-white/15 px-4 py-3">
          <FeedbackPanel key={photo.id} target={{ kind: 'photo', albumId, photoId: photo.id }} feedback={feedback} tone="dark" />
        </div>
      )}

      <div data-viewer-fade className="relative flex min-h-12 shrink-0 items-center justify-between gap-2 px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] text-[12px] text-white/80">
        <span className="min-w-0 truncate">{takenAt && `${formatDotted(takenAt)} ${toTimeInput(takenAt)}`}</span>
        {photo && (
          <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTalking((on) => !on)}
            aria-pressed={talking}
            aria-label={t.feedback.open(feedback.comments.length)}
            className={`ui-pop flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold tabular-nums retro:pixel-outline retro:pixel-thin retro:[--pixel-border:var(--color-white)] ${
              talking ? 'bg-white text-ink' : 'bg-white/15 text-white'
            }`}
          >
            <MessageCircle size={15} strokeWidth={1.75} />
            {reacted}
            {feedback.comments.length > 0 && feedback.comments.length}
          </button>
          <button
            type="button"
            onClick={() => save(photo.id)}
            disabled={saving}
            aria-label={t.albums.save}
            className="ui-pop flex size-8 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-50 retro:pixel-outline retro:pixel-thin retro:[--pixel-border:var(--color-white)]"
          >
            <Download size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onSetCover(isCover ? null : photo.id)}
            disabled={coverPending}
            aria-pressed={isCover}
            className={`ui-pop h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold disabled:opacity-50 retro:pixel-outline retro:pixel-thin retro:[--pixel-border:var(--color-white)] ${
              isCover ? 'bg-amber-soft text-amber-strong' : 'bg-white/15 text-white'
            }`}
          >
            {isCover ? t.albums.bestCut : t.albums.makeBestCut}
          </button>
          </div>
        )}
      </div>
    </div>
  )
}

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

function NavButton({ side, label, onClick, children }: { side: 'left' | 'right'; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 pb-0.5 text-[24px] retro:bg-white retro:pb-0 retro:pixel-btn retro:pixel-thin ${
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
function ViewerPhoto({
  src,
  thumb,
  eager,
  active,
  onZoomChange,
}: {
  src: string | null
  thumb: string | null
  eager: boolean
  active: boolean
  onZoomChange: (zoomed: boolean) => void
}) {
  const t = useT()
  const { failed, onError } = useImageFailed(src)
  const { ref: zoomRef, bind, style, reset } = useZoom((zoomed) => active && onZoomChange(zoomed))
  // A photo swiped away comes back at its normal size.
  useEffect(() => {
    if (!active) reset()
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps -- reset is new each render
  if (src && !failed) {
    return (
      <div ref={zoomRef} {...bind} style={style} className="relative size-full select-none">
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
