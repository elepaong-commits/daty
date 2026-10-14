import { Camera, type LucideIcon, MapPin, Star, Video } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { categoryOf, PHOTO_GRADIENTS } from '../../lib/categories'
import { formatDotted, formatSlashDay, parseDateOnly } from '../../lib/dates'
import type { Album } from '../../lib/types'
import { useT } from '../../lib/i18n'
import { useImageFailed } from '../../lib/useImageFailed'

const LAYER_TILTS = ['-rotate-6', 'rotate-5'] as const

export function AlbumCard({ album, size, className = '', style }: { album: Album; size: 'large' | 'small'; className?: string; style?: CSSProperties }) {
  const t = useT()
  const date = parseDateOnly(album.albumDate)
  const large = size === 'large'
  // Small cards have room for one place; the rest show as a count.
  const shownPlaces = large ? album.places : album.places.slice(0, 1)
  const morePlaces = album.places.length - shownPlaces.length
  const onlyPlace = album.places.length === 1 ? album.places[0] : undefined

  return (
    <Link to={`/albums/${album.id}`} className={`group flex min-w-0 flex-col gap-2.5 pt-1.5 ${className}`} style={style}>
      {/* The tilted prints spread further on the big desktop card, so it gets more room around them. */}
      <div className={large ? 'px-1.5 lg:px-5 lg:py-7' : 'px-1.5'}>
        <PhotoStack album={album} heightClass={large ? 'h-60 lg:h-[440px]' : 'h-[225px] lg:h-[200px]'} date={formatDotted(date)} />
      </div>
      <div className="flex flex-col px-0.5">
        <h3 className={`font-display leading-[1.375] ${large ? 'text-[20px] lg:text-[22px]' : 'text-[16px]'}`}>
          {formatSlashDay(date)} · {album.title}
        </h3>
        {shownPlaces.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {shownPlaces.map((place) => (
              <span key={place.id} className="flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-[11px] leading-normal font-semibold text-brand-strong">
                <MapPin size={12} strokeWidth={1.75} /> {place.name}
              </span>
            ))}
            {morePlaces > 0 && (
              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] leading-normal font-semibold text-brand-strong">+{morePlaces}</span>
            )}
            {large && onlyPlace?.address && (
              <span className="rounded-md bg-sand-soft px-2 py-0.5 text-[11px] leading-normal font-semibold">{onlyPlace.address}</span>
            )}
          </div>
        )}
        {album.highlightNote && (
          <div className="pt-2">
            <div className="flex flex-col rounded-xl bg-amber-soft px-2.5 py-2 text-[12px] leading-[1.375]">
              <span className="flex items-center gap-1 font-bold text-amber-strong">
                <Star size={12} strokeWidth={1.75} /> {t.common.mustSee}
              </span>
              <span className="text-amber-ink">{album.highlightNote}</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

/** Three tilted layers like a pile of prints. Real photos replace the gradient placeholders once uploaded. */
function PhotoStack({ album, heightClass, date }: { album: Album; heightClass: string; date: string }) {
  const category = album.category ?? 'CAFE'
  const gradients = PHOTO_GRADIENTS[category]
  const { Icon } = categoryOf(category)
  // The cover (best cut, or the first photo when none is picked) sits on top of the pile.
  const { coverPhoto } = album
  const photos = coverPhoto ? [coverPhoto, ...album.photos.filter((p) => p.id !== coverPhoto.id)].slice(0, 3) : []
  const videoCount = album.photos.filter((p) => p.mediaType === 'VIDEO').length

  const layer = (i: number) => (
    <StackLayer src={photos[i]?.thumbnailUrl} gradient={gradients[i % gradients.length]!} Icon={i === 0 ? Icon : null} />
  )

  return (
    <div className={`relative w-full transition-transform duration-200 lg:group-hover:-translate-y-1 ${heightClass}`}>
      {LAYER_TILTS.map((tilt, i) => (
        <div
          key={tilt}
          className={`absolute inset-0 overflow-hidden rounded-2xl border-4 border-white shadow-photo ${tilt}`}
          aria-hidden="true"
        >
          {layer(i + 1)}
        </div>
      ))}
      <div className="absolute inset-0 overflow-hidden rounded-2xl border-4 border-white shadow-photo">
        {layer(0)}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_55%,rgba(0,0,0,0.18))]" />
        <span className="absolute top-2 left-2 rounded-lg bg-white/95 px-2 py-1 text-[11px] leading-normal font-bold">{date}</span>
        <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] leading-normal font-semibold text-white">
          <Camera size={12} strokeWidth={1.75} /> {album.photoCount - videoCount}
          {videoCount > 0 && (
            <>
              <span className="pl-1">·</span>
              <Video size={12} strokeWidth={1.75} /> {videoCount}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

/** One print in the pile; a photo whose file is gone falls back to the gradient. */
function StackLayer({
  src,
  gradient: [from, to],
  Icon,
}: {
  src: string | null | undefined
  gradient: [string, string]
  Icon: LucideIcon | null
}) {
  const { failed, onError } = useImageFailed(src)
  if (src && !failed) return <img src={src} alt="" onError={onError} className="size-full object-cover" />
  return (
    <div className="flex size-full items-center justify-center" style={{ background: `linear-gradient(${from}, ${to})` }}>
      {Icon && <Icon size={40} strokeWidth={1.5} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.18)]" />}
    </div>
  )
}
