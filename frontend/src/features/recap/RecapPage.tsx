import { Share2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Chip, QueryState } from '../../components/Field'
import { Stars } from '../../components/Stars'
import { SubHeader } from '../../components/SubHeader'
import { useT } from '../../lib/i18n'
import { useMe, useRecap } from '../../lib/queries'
import { saveBlob } from '../../lib/download'
import { useIsRetro } from '../../lib/theme'
import { drawRecapImage } from './recapImage'
import type { Recap } from '../../lib/types'

/** One year of dates in numbers: how often, where, and what the two liked best. */
export function RecapPage() {
  const t = useT()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const { data: recap, isLoading, error } = useRecap(year)

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[880px] lg:px-5">
      <SubHeader eyebrow={t.recap.eyebrow} title={t.recap.title(year)} fallback="/albums" />
      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-8">
        {recap && recap.years.length > 1 && (
          <div className="scrollbar-none flex shrink-0 gap-2 overflow-x-auto py-1 [--chip-border:var(--color-sand)] retro:px-0.5 retro:py-1.5">
            {recap.years.map((y) => (
              <Chip key={y} selected={y === year} onClick={() => setYear(y)}>
                {t.recap.year(y)}
              </Chip>
            ))}
          </div>
        )}
        {!recap ? (
          <QueryState isLoading={isLoading} error={error} />
        ) : recap.totals.visits === 0 ? (
          <p className="ui-empty rounded-2xl bg-surface/60 py-10 text-center text-[13px] text-muted">{t.recap.empty}</p>
        ) : (
          <>
            <RecapBody recap={recap} />
            <ShareRecap recap={recap} />
          </>
        )}
      </div>
    </div>
  )
}

function RecapBody({ recap }: { recap: Recap }) {
  const t = useT()
  const { totals } = recap
  const tiles: [string, number][] = [
    [t.recap.totals.days, totals.days],
    [t.recap.totals.visits, totals.visits],
    [t.recap.totals.places, totals.places],
    [t.recap.totals.newPlaces, totals.newPlaces],
    [t.recap.totals.photos, totals.photos],
    [t.recap.totals.videos, totals.videos],
  ]
  const topCategory = Math.max(...recap.categories.map((c) => c.count), 1)

  return (
    <>
      <dl className="grid grid-cols-3 gap-2 retro:gap-3 retro:p-0.5">
        {tiles.map(([label, value]) => (
          <div key={label} className="ui-box-thin flex flex-col gap-0.5 rounded-2xl bg-surface p-3">
            <dt className="text-[11px] leading-normal text-muted">{label}</dt>
            <dd className="font-display text-[26px] leading-[1.15] tabular-nums retro:text-[22px]">{value}</dd>
          </div>
        ))}
      </dl>

      <Card title={t.recap.months}>
        <div className="pb-5">
          <MonthBars months={recap.months} />
        </div>
      </Card>

      {recap.categories.length > 0 && (
        <Card title={t.recap.categories}>
          <ul className="flex flex-col gap-2">
            {recap.categories.map(({ category, count }) => (
              <li key={category} className="flex items-center gap-2 text-[13px]">
                <span className="flex w-[92px] shrink-0 items-center gap-1.5 truncate">
                  <CategoryIcon category={category} /> {t.categories[category]}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand-soft retro:rounded-none">
                  <span className="block h-full rounded-full bg-brand retro:rounded-none" style={{ width: `${(count / topCategory) * 100}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right text-[12px] text-muted tabular-nums">{t.recap.times(count)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {recap.areas.length > 0 && (
        <Card title={t.recap.areas}>
          <ol className="flex flex-col gap-1.5">
            {recap.areas.map(({ name, count }, i) => (
              <Row key={name} rank={i + 1} trailing={t.recap.times(count)}>
                {name}
              </Row>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {recap.mostVisited.length > 0 && (
          <Card title={t.recap.mostVisited}>
            <ol className="flex flex-col gap-1.5">
              {recap.mostVisited.map((place, i) => (
                <Row key={place.placeId} rank={i + 1} to={`/places/${place.placeId}`} trailing={t.recap.times(place.visits)}>
                  {place.name}
                </Row>
              ))}
            </ol>
          </Card>
        )}
        {recap.topRated.length > 0 && (
          <Card title={t.recap.topRated}>
            <ol className="flex flex-col gap-1.5">
              {recap.topRated.map((place, i) => (
                <Row
                  key={place.placeId}
                  rank={i + 1}
                  to={`/places/${place.placeId}`}
                  trailing={
                    <span className="flex items-center gap-1">
                      <Stars value={place.rating ?? 0} /> {place.rating?.toFixed(1)}
                    </span>
                  }
                >
                  {place.name}
                </Row>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ui-box-thin flex flex-col gap-3 rounded-2xl bg-surface p-4 retro:mx-0.5">
      <h2 className="font-display text-[17px] leading-normal">{title}</h2>
      {children}
    </section>
  )
}

function Row({ rank, to, trailing, children }: { rank: number; to?: string; trailing: ReactNode; children: ReactNode }) {
  const name = <span className="min-w-0 flex-1 truncate font-semibold">{children}</span>
  return (
    <li className="flex items-center gap-2 text-[13px] leading-normal">
      <span className="w-4 shrink-0 text-center text-[12px] text-muted tabular-nums">{rank}</span>
      {to ? (
        <Link to={to} className="flex min-w-0 flex-1 hover:text-brand-text">
          {name}
        </Link>
      ) : (
        name
      )}
      <span className="shrink-0 text-[12px] text-muted tabular-nums">{trailing}</span>
    </li>
  )
}

const BAR_AREA = 96 // px

/** Visits per month: one series, so one colour and no legend; every bar is labelled with its count. */
function MonthBars({ months }: { months: number[] }) {
  const t = useT()
  const max = Math.max(...months, 1)
  return (
    <ol className="flex items-end gap-1.5 border-b border-sand" aria-label={t.recap.months}>
      {months.map((count, i) => (
        <li key={i} className="group relative flex min-w-0 flex-1 flex-col items-center" title={t.recap.monthVisits(i + 1, count)}>
          <span className="h-4 text-[10px] leading-4 text-muted tabular-nums">{count > 0 && count}</span>
          <span className="flex w-full items-end justify-center" style={{ height: BAR_AREA }}>
            <span
              className="w-full max-w-[22px] rounded-t-[4px] bg-brand group-hover:bg-brand-strong retro:rounded-none"
              style={{ height: count === 0 ? 0 : Math.max((count / max) * BAR_AREA, 3) }}
            />
          </span>
          <span className="sr-only">{t.recap.monthVisits(i + 1, count)}</span>
          {/* Sits under the baseline; shown for every month on wide screens, every third on phones. */}
          <span
            aria-hidden="true"
            className={`absolute top-full pt-1 text-[10px] whitespace-nowrap text-muted tabular-nums ${i % 3 === 0 ? '' : 'hidden lg:block'}`}
          >
            {t.recap.month(i + 1)}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The recap as a picture, made as soon as the numbers are in so the tap can open the share sheet
 * right away (it only opens straight from a tap). Without file sharing the picture is saved instead.
 */
function ShareRecap({ recap }: { recap: Recap }) {
  const t = useT()
  const retro = useIsRetro()
  const couple = useMe().data?.couple
  const names = couple?.users.map((u) => u.nickname).join(' ♥ ') ?? ''
  const [image, setImage] = useState<{ key: Recap; file: File } | null>(null)

  useEffect(() => {
    let current = true
    drawRecapImage(recap, t, names, retro)
      .then((blob) => current && setImage({ key: recap, file: new File([blob], t.recap.imageName(recap.year), { type: 'image/png' }) }))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [recap, t, names, retro])

  const file = image?.key === recap ? image.file : null

  function share() {
    if (!file) return
    if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file] }).catch(() => {})
    else saveBlob(file, file.name)
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={!file}
      className="ui-btn mt-2 flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand-strong text-[15px] font-semibold text-white disabled:opacity-50 retro:mb-1.5 retro:text-[13px]"
    >
      <Share2 size={17} strokeWidth={2} aria-hidden="true" />
      {t.recap.share}
    </button>
  )
}
