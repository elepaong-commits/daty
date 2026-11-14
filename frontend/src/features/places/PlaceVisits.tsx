import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Stars } from '../../components/Stars'
import { formatDotted, toDateInput } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import type { PlaceDetail } from '../../lib/types'

/**
 * Last visit and the couple's rating; once there are two or more visits, each one is listed with its own date and rating,
 * and opens that day on the calendar.
 */
export function PlaceVisits({ place }: { place: PlaceDetail }) {
  const t = useT()
  const many = place.visits.length > 1

  return (
    <section className="ui-box-thin flex flex-col gap-3 rounded-2xl bg-surface p-3">
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-[3px]">
          <span className="text-[11px] text-muted">{many ? t.place.lastVisitedDate : t.place.visitedDate}</span>
          <span className="text-[14px] font-semibold">
            {place.lastVisitedAt ? formatDotted(new Date(place.lastVisitedAt)) : t.common.notVisitedYet}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-[3px]">
          <span className="text-[11px] text-muted">{many ? t.place.averageRating : t.common.ourRating}</span>
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

      {many && (
        <div className="flex flex-col gap-2 border-t border-card-border pt-3">
          <h3 className="text-[11px] font-semibold text-muted">{t.place.visitHistory(place.visits.length)}</h3>
          <ul className="flex flex-col gap-2">
            {place.visits.map((visit) => (
              <li key={visit.recordId}>
                <Link
                  to="/calendar"
                  state={{ focusDate: toDateInput(new Date(visit.scheduledAt)) }}
                  className="flex items-center gap-2 rounded-xl bg-brand-soft py-2.5 pr-2 pl-3 retro:mx-0.5 retro:pixel-outline retro:pixel-thin retro:[--pixel-border:var(--color-brand)]"
                >
                  <span className="flex-1 text-[13px] font-semibold">{formatDotted(new Date(visit.scheduledAt))}</span>
                  {visit.rating !== null ? (
                    <span className="flex items-center gap-1.5 text-[12px]">
                      <Stars value={visit.rating} />
                      <span className="font-semibold">{visit.rating.toFixed(1)}</span>
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted">-</span>
                  )}
                  <ChevronRight size={14} strokeWidth={1.75} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
