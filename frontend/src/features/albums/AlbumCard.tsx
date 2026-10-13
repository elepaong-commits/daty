import { Link } from 'react-router'
import { categoryOf, PHOTO_GRADIENTS } from '../../lib/categories'
import { formatDotted, formatSlashDay, parseDateOnly } from '../../lib/dates'
import type { Album } from '../../lib/types'

const LAYER_TILTS = ['-rotate-6', 'rotate-5'] as const

export function AlbumCard({ album, size }: { album: Album; size: 'large' | 'small' }) {
  const date = parseDateOnly(album.albumDate)
  const large = size === 'large'
  const firstPlace = album.places[0]

  return (
    <Link to={`/albums/${album.id}`} className="flex min-w-0 flex-col gap-2.5 pt-1.5">
      <div className="px-1.5">
        <PhotoStack album={album} heightClass={large ? 'h-60' : 'h-[225px]'} date={formatDotted(date)} />
      </div>
      <div className="flex flex-col px-0.5">
        <h3 className={`font-display leading-[1.375] ${large ? 'text-[20px]' : 'text-[16px]'}`}>
          {formatSlashDay(date)} · {album.title}
        </h3>
        {firstPlace && (
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] leading-normal font-semibold text-brand-strong">
              📍 {firstPlace.name}
            </span>
            {large && firstPlace.address && (
              <span className="rounded-md bg-sand-soft px-2 py-0.5 text-[11px] leading-normal font-semibold">{firstPlace.address}</span>
            )}
          </div>
        )}
        {album.highlightNote && (
          <div className="pt-2">
            <div className="flex flex-col rounded-xl bg-amber-soft px-2.5 py-2 text-[12px] leading-[1.375]">
              <span className="font-bold text-amber-strong">⭐ 꼭 봐야 할 포인트</span>
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
  const emoji = categoryOf(category).emoji
  // The best cut sits on top of the pile.
  const photos = [...album.photos].sort((a, b) => Number(b.id === album.coverPhotoId) - Number(a.id === album.coverPhotoId)).slice(0, 3)

  const layer = (i: number) => {
    const photo = photos[i]
    const [from, to] = gradients[i % gradients.length]!
    return photo?.imageUrl ? (
      <img src={photo.imageUrl} alt="" className="size-full object-cover" />
    ) : (
      <div className="flex size-full items-center justify-center" style={{ background: `linear-gradient(${from}, ${to})` }}>
        <span className="text-[40px] leading-none [text-shadow:0_4px_6px_rgba(0,0,0,0.18)]">{i === 0 ? emoji : ''}</span>
      </div>
    )
  }

  return (
    <div className={`relative w-full ${heightClass}`}>
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
        <span className="absolute right-2 bottom-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] leading-normal font-semibold text-white">
          📷 {album.photoCount}
        </span>
      </div>
    </div>
  )
}
