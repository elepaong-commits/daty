import { Link, useNavigate, useParams } from 'react-router'
import { QueryState } from '../../components/Field'
import { PhotoTile } from '../../components/PhotoTile'
import { Stars } from '../../components/Stars'
import { HeaderAction, SubHeader } from '../../components/SubHeader'
import { categoryOf, TIPS } from '../../lib/categories'
import { formatDotted, formatSlashDay, parseDateOnly } from '../../lib/dates'
import { usePlace } from '../../lib/queries'

export function PlaceDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: place, isLoading, error } = usePlace(id)
  const edit = () => navigate(`/places/${id}/edit`)

  if (!place) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <SubHeader eyebrow="데이트 지도" title="우리의 장소 기록" fallback="/" />
        <QueryState isLoading={isLoading} error={error} />
      </div>
    )
  }

  const visited = place.status === 'VISITED'
  const category = categoryOf(place.category)
  const tip = place.tipType ? TIPS[place.tipType] : null
  const album = place.albums[0]
  const heroPhoto = album?.photos.find((p) => p.id === album.coverPhotoId) ?? album?.photos[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SubHeader
        eyebrow={`데이트 지도 · ${visited ? '갔던 곳' : '가고 싶은 곳'}`}
        title="우리의 장소 기록"
        fallback="/"
        action={<HeaderAction onClick={edit}>수정</HeaderAction>}
      />

      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5">
        <div className="relative h-48 shrink-0">
          <PhotoTile src={heroPhoto?.imageUrl} category={place.category} className="size-full rounded-xl" emojiSize={56} />
          <span className={`absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold ${visited ? 'text-brand' : 'text-coral'}`}>
            {visited ? '✓ 다녀온 곳' : '♡ 가고 싶은 곳'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-[26px] leading-[1.25]">{place.name}</h2>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="rounded-md bg-brand-soft px-2 py-[3px] font-semibold text-brand-strong">
              {category.emoji} {category.label}
            </span>
            {place.address && <span className="text-muted">📍 {place.address}</span>}
          </div>
        </div>

        <div className="flex gap-4 rounded-2xl bg-white p-3">
          <div className="flex flex-1 flex-col gap-[3px]">
            <span className="text-[11px] text-muted">방문한 날</span>
            <span className="text-[14px] font-semibold">
              {place.lastVisitedAt ? formatDotted(new Date(place.lastVisitedAt)) : '아직 안 가 봤어요'}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-[3px]">
            <span className="text-[11px] text-muted">우리의 평점</span>
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

        {place.tipText && (
          <div className="flex flex-col gap-1 rounded-xl bg-amber-soft p-3">
            <span className="text-[12px] font-bold text-amber-strong">{tip ? `${tip.label} · 메모` : '📝 메모'}</span>
            <p className="text-[13px] leading-normal text-amber-ink">{place.tipText}</p>
          </div>
        )}

        {album && (
          <section className="flex flex-col gap-2 rounded-2xl bg-white p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[18px]">함께 남긴 사진</h3>
              <Link to={`/albums/${album.id}`} className="text-[11px] font-semibold text-brand">
                앨범 보기 ›
              </Link>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <PhotoTile
                  key={i}
                  src={album.photos[i]?.imageUrl}
                  category={place.category}
                  className="h-[66px] min-w-0 flex-1 rounded-xl"
                  emojiSize={22}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                {formatSlashDay(parseDateOnly(album.albumDate))} · {album.title}
              </span>
              <span className="text-[11px] text-muted">{album.photoCount}장</span>
            </div>
          </section>
        )}

        <div className="mt-auto pt-4 pb-5">
          <button
            type="button"
            onClick={edit}
            className="h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-[0_6px_14px_rgba(0,168,150,0.25)]"
          >
            장소 정보 수정
          </button>
        </div>
      </div>
    </div>
  )
}
