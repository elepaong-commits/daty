import { Check, Heart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CategoryIcon } from '../../components/CategoryIcon'
import { useT } from '../../lib/i18n'
import type { Place } from '../../lib/types'

interface Props {
  places: Place[]
  selectedIds: number[]
  onSelect: (place: Place) => void
}

/** Pick from the couple's saved places; places they want to go come first. */
export function SavedPlacePicker({ places, selectedIds, onSelect }: Props) {
  const t = useT()
  const [query, setQuery] = useState('')
  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return places
      .filter((p) => p.name.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q))
      .sort((a, b) => Number(a.status === 'VISITED') - Number(b.status === 'VISITED'))
  }, [places, query])

  if (places.length === 0) return <p className="py-3 text-[12px] text-muted">{t.schedule.noSaved}</p>

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.schedule.savedSearch}
        aria-label={t.schedule.savedSearch}
        className="h-9 w-full rounded-xl border border-field-border bg-field px-3 text-[13px] outline-none placeholder:text-placeholder focus:border-brand retro:border-0 retro:bg-surface retro:pixel-field retro:placeholder:text-faint"
      />
      <ul className="scrollbar-none flex max-h-[188px] flex-col gap-1.5 overflow-y-auto" role="listbox" aria-label={t.schedule.place}>
        {listed.length === 0 && <li className="py-3 text-center text-[12px] text-muted">{t.schedule.noMatch}</li>}
        {listed.map((place) => {
          const selected = selectedIds.includes(place.id)
          return (
            <li key={place.id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onSelect(place)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left ${
                  selected ? 'border-brand bg-brand-soft' : 'border-field-border bg-surface'
                }`}
              >
                <span className="shrink-0 text-brand-text">
                  <CategoryIcon category={place.category} size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold">{place.name}</span>
                  {place.address && <span className="truncate text-[11px] text-muted">{place.address}</span>}
                </span>
                <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${place.status === 'WISH' ? 'text-coral-strong' : 'text-brand-text'}`}>
                  {place.status === 'WISH' ? <Heart size={12} strokeWidth={1.75} /> : <Check size={12} strokeWidth={1.75} />} {t.status[place.status]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
