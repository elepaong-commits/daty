import { Camera, MapPin, Star, Video } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { CategoryIcon } from '../../components/CategoryIcon'
import { PHOTO_GRADIENTS } from '../../lib/categories'
import { albumHeading, formatDottedRange, parseDateOnly } from '../../lib/dates'
import type { AlbumSummary, PlaceCategory } from '../../lib/types'
import { useT } from '../../lib/i18n'
import { useImageFailed } from '../../lib/useImageFailed'

// Classic: two prints tilted under the cover. Pixel: one print set off up and to the right, untilted.
const LAYERS = [
  '-rotate-6 retro:rotate-0 retro:translate-x-[5px] retro:-translate-y-1',
  'rotate-5 retro:hidden',
] as const

export function AlbumCard({ album, className = '', style }: { album: AlbumSummary; className?: string; style?: CSSProperties }) {
  const t = useT()
  const start = parseDateOnly(album.albumDate)
  const end = parseDateOnly(album.albumEndDate)
  // Cards have room for one place; the rest show as a count.
  const [shownPlace] = album.places
  const morePlaces = album.places.length - 1

  return (
    <Link
      to={`/albums/${album.id}`}
      className={`group flex min-w-0 flex-col gap-2.5 pt-1.5 ui-box-thin retro:m-0.5 retro:gap-2 retro:bg-surface retro:p-2 retro:pt-2.5 ${className}`}
      style={style}
    >
      <div className="px-1.5 retro:pr-2 retro:pl-0">
        <PhotoStack album={album} date={album.monthly ? t.dates.yearMonth(start) : formatDottedRange(start, end)} />
      </div>
      <div className="flex flex-col px-0.5">
        <h3 className="font-display text-[16px] leading-[1.375] retro:text-[14px]">
          {albumHeading(album, t.dates.yearMonth)}
        </h3>
        {shownPlace && (
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="ui-badge flex min-w-0 items-center gap-1">
              <MapPin size={12} strokeWidth={1.75} className="shrink-0" /> <span className="truncate">{shownPlace.name}</span>
            </span>
            {morePlaces > 0 && <span className="ui-badge">+{morePlaces}</span>}
          </div>
        )}
        {album.highlightNote && (
          <div className="pt-2">
            <div className="flex flex-col rounded-xl bg-amber-soft px-2.5 py-2 text-[12px] leading-[1.375] retro:bg-coral-soft retro:px-2 retro:py-1.5 retro:text-[11px]">
              <span className="flex items-center gap-1 font-bold text-amber-strong retro:font-normal retro:text-coral-strong">
                <Star size={12} strokeWidth={1.75} className="retro:hidden" /> {t.common.mustSee}
              </span>
              <span className="ui-prose text-amber-ink retro:text-ink">{album.highlightNote}</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

/** A pile of prints. Real photos replace the gradient placeholders once uploaded. */
function PhotoStack({ album, date }: { album: AlbumSummary; date: string }) {
  const t = useT()
  const category = album.category ?? 'CAFE'
  const gradients = PHOTO_GRADIENTS[category]
  // The cover (best cut, or the first photo when none is picked) sits on top of the pile.
  const { previewPhotos: photos, videoCount } = album

  const layer = (i: number) => (
    <StackLayer src={photos[i]?.thumbnailUrl} gradient={gradients[i % gradients.length]!} category={i === 0 ? category : null} />
  )
  const print = 'absolute inset-0 overflow-hidden rounded-2xl border-4 border-white shadow-photo retro:border-0 retro:bg-surface retro:pixel-outline retro:pixel-thin'

  return (
    <div className="relative h-[225px] w-full transition-transform duration-200 lg:h-[200px] lg:group-hover:-translate-y-1 retro:h-[120px] retro:lg:h-[160px]">
      {LAYERS.map((placement, i) => (
        <div key={placement} className={`${print} ${placement}`} aria-hidden="true">
          {layer(i + 1)}
        </div>
      ))}
      <div className={print}>
        {layer(0)}
        <div className="absolute inset-0 bg-linear-to-b from-transparent from-55% to-night/20 retro:hidden" />
        {/* Classic: date top left, counts bottom right. Pixel: both as dark tags along the bottom left. */}
        <div className="absolute inset-2 flex flex-col items-start justify-between text-[11px] leading-normal retro:inset-1 retro:flex-row retro:items-end retro:justify-start retro:gap-1 retro:text-[11px] retro:leading-[14px]">
          <span className="rounded-lg bg-surface/95 px-2 py-1 font-bold retro:bg-night/85 retro:px-1 retro:py-0 retro:font-normal retro:text-white">{date}</span>
          <span className="flex items-center gap-1 self-end rounded-full bg-night/70 px-2 py-0.5 font-semibold text-white retro:bg-night/85 retro:px-1 retro:py-0 retro:font-normal">
            <Camera size={12} strokeWidth={1.75} className="retro:hidden" /> {album.photoCount - videoCount}
            {videoCount > 0 && (
              <>
                <span className="pl-1">·</span>
                <Video size={12} strokeWidth={1.75} /> {videoCount}
              </>
            )}
          </span>
        </div>
        {album.coverPhotoId !== null && (
          <span className="absolute top-1 right-1 hidden items-center gap-0.5 bg-amber px-1 text-[11px] leading-[14px] text-ink retro:flex">
            <Star size={10} strokeWidth={2} /> {t.albums.bestCut}
          </span>
        )}
      </div>
    </div>
  )
}

/** One print in the pile; a photo whose file is gone falls back to the gradient. */
function StackLayer({
  src,
  gradient: [from, to],
  category,
}: {
  src: string | null | undefined
  gradient: [string, string]
  /** Drawn on the top print only. */
  category: PlaceCategory | null
}) {
  const { failed, onError } = useImageFailed(src)
  if (src && !failed) return <img src={src} alt="" onError={onError} className="size-full object-cover" />
  return (
    <div className="flex size-full items-center justify-center" style={{ background: `linear-gradient(${from}, ${to})` }}>
      {category && <CategoryIcon category={category} size={40} spriteScale={4} strokeWidth={1.5} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.18)]" />}
    </div>
  )
}
