import { Check, Heart, Map, MapPin } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { CategoryIcon } from '../../components/CategoryIcon'
import { QueryState } from '../../components/Field'
import { PhotoTile } from '../../components/PhotoTile'
import { Stars } from '../../components/Stars'
import { HeaderAction, SubHeader } from '../../components/SubHeader'
import { categoryOf } from '../../lib/categories'
import { formatDotted, formatSlashDay, parseDateOnly } from '../../lib/dates'
import { usePlace } from '../../lib/queries'
import type { Place } from '../../lib/types'
import { useT } from '../../lib/i18n'
import { PlaceHero } from './PlaceHero'
import { PlaceNotes } from './PlaceNotes'

export function PlaceDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const t = useT()
  const { data: place, isLoading, error } = usePlace(id)
  const edit = () => navigate(`/places/${id}/edit`)

  if (!place) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <SubHeader eyebrow={t.place.eyebrow} title={t.place.title} fallback="/" />
        <QueryState isLoading={isLoading} error={error} />
      </div>
    )
  }

  const visited = place.status === 'VISITED'
  const category = categoryOf(place.category)
  const album = place.albums[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SubHeader
        eyebrow={`${t.place.eyebrow} · ${t.status[place.status]}`}
        title={t.place.title}
        fallback="/"
        action={<HeaderAction onClick={edit}>{t.common.edit}</HeaderAction>}
      />

      {/* The pixel outlines sit outside the boxes, so the column gets a few px of room in that design. */}
      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 retro:gap-4 retro:pt-1">
        <div className="ui-box relative h-48 shrink-0">
          <PlaceHero
            googlePlaceId={place.googlePlaceId}
            fallbackSrc={album?.coverPhoto?.thumbnailUrl}
            category={place.category}
            className="size-full rounded-xl"
          />
          <span className={`absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold ${visited ? 'text-brand' : 'text-coral'}`}>
            {visited ? <Check size={12} strokeWidth={1.75} /> : <Heart size={12} strokeWidth={1.75} />} {t.place.badge[place.status]}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-[26px] leading-[1.25] retro:font-pixel retro:text-[24px] retro:pixel-crisp">{place.name}</h2>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-brand-soft px-2 py-[3px] font-semibold text-brand-strong">
              <CategoryIcon category={category.value} size={12} /> {t.categories[category.value]}
            </span>
            {place.address && (
              <span className="flex min-w-0 items-center gap-1 text-muted">
                <MapPin size={12} strokeWidth={1.75} className="shrink-0" /> {place.address}
              </span>
            )}
          </div>
        </div>

        <div className="ui-box-thin flex gap-4 rounded-2xl bg-white p-3">
          <div className="flex flex-1 flex-col gap-[3px]">
            <span className="text-[11px] text-muted">{t.place.visitedDate}</span>
            <span className="text-[14px] font-semibold">
              {place.lastVisitedAt ? formatDotted(new Date(place.lastVisitedAt)) : t.common.notVisitedYet}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-[3px]">
            <span className="text-[11px] text-muted">{t.common.ourRating}</span>
            {place.rating !== null ? (
              <span className="flex items-center gap-2 text-[14px]">
                <Stars value={place.rating} />
                <span className="font-semibold">{place.rating.toFixed(1)}</span>
              </span>
            ) : (
              <span className="text-[14px] font-semibold text-muted">-</span>
            )}
          </div>
        </div>

        <PlaceNotes placeId={place.id} notes={place.notes} />

        {album && (
          <section className="ui-box-thin flex flex-col gap-2 rounded-2xl bg-white p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[18px]">{t.place.photos}</h3>
              <Link to={`/albums/${album.id}`} className="text-[11px] font-semibold text-brand">
                {t.place.viewAlbum}
              </Link>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <PhotoTile
                  key={i}
                  src={album.photos[i]?.thumbnailUrl}
                  category={place.category}
                  className="h-[66px] min-w-0 flex-1 rounded-xl"
                  iconSize={22}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                {formatSlashDay(parseDateOnly(album.albumDate))} · {album.title}
              </span>
              <span className="text-[11px] text-muted">{t.common.photoCount(album.photoCount)}</span>
            </div>
          </section>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4 pb-5">
          <a
            href={googleMapsLink(place)}
            target="_blank"
            rel="noreferrer"
            className="ui-btn flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-brand bg-white text-[16px] font-semibold text-brand retro:mb-1.5 retro:text-[14px] retro:text-brand-strong"
          >
            <Map size={18} strokeWidth={1.75} />
            {t.place.openGoogleMaps}
          </a>
          <button
            type="button"
            onClick={edit}
            className="ui-btn h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-[0_6px_14px_rgba(0,168,150,0.25)] retro:mb-1.5 retro:text-[14px]"
          >
            {t.place.editPlace}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The place's own Google Maps page when we have it, otherwise a Maps search that lands on it. */
function googleMapsLink(place: Place) {
  if (place.googleMapsUrl) return place.googleMapsUrl
  const params = new URLSearchParams({ api: '1' })
  if (place.googlePlaceId) {
    params.set('query', place.name)
    params.set('query_place_id', place.googlePlaceId)
  } else if (place.latitude !== null && place.longitude !== null) {
    params.set('query', `${place.latitude},${place.longitude}`)
  } else {
    params.set('query', [place.name, place.address].filter(Boolean).join(' '))
  }
  return `https://www.google.com/maps/search/?${params}`
}
