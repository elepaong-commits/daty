import { useMemo, useState } from 'react'
import searchIcon from '../../assets/icons/search.svg'
import { Chip, QueryState } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { CATEGORIES } from '../../lib/categories'
import { daysTogether } from '../../lib/dates'
import { useCouple, usePlaces } from '../../lib/queries'
import type { PlaceCategory, PlaceStatus } from '../../lib/types'
import { DateMap } from './DateMap'
import { PlaceSheet } from './PlaceSheet'

export function MapPage() {
  const { data: couple } = useCouple()
  const { data: places = [], isLoading, error } = usePlaces()
  const [status, setStatus] = useState<PlaceStatus>('VISITED')
  const [category, setCategory] = useState<PlaceCategory | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Category and search narrow both the pins and the cards; status only dims the other pins.
  const filtered = useMemo(
    () =>
      places.filter(
        (p) => (category === null || p.category === category) && p.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [places, category, query],
  )
  const counts = {
    VISITED: places.filter((p) => p.status === 'VISITED').length,
    WISH: places.filter((p) => p.status === 'WISH').length,
  }
  const listed = filtered.filter((p) => p.status === status)

  function changeStatus(next: PlaceStatus) {
    setStatus(next)
    setSelectedId(null)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        eyebrow={couple ? `D+${daysTogether(couple.anniversaryDate)} · 함께 걸은 곳들` : '함께 걸은 곳들'}
        title="우리의 데이트 지도"
        actions={
          <button
            type="button"
            onClick={() => {
              setSearchOpen((open) => !open)
              setQuery('')
            }}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white"
            aria-label="장소 검색"
            aria-expanded={searchOpen}
          >
            <img src={searchIcon} alt="" width={18} height={18} />
          </button>
        }
      >
        {searchOpen && (
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장소 이름으로 찾기"
            className="mt-3 h-10 w-full rounded-xl border border-sand bg-white px-3 text-[14px] outline-none placeholder:text-placeholder focus:border-brand"
          />
        )}
      </ScreenHeader>

      <div className="mx-5 flex h-12 shrink-0 rounded-2xl bg-white p-1" role="tablist">
        {(['VISITED', 'WISH'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => changeStatus(value)}
            className={`flex-1 rounded-xl text-[14px] leading-normal font-semibold ${status === value ? 'bg-brand text-white' : 'text-ink'}`}
          >
            {value === 'VISITED' ? `✓ 갔던 곳 ${counts.VISITED}` : `♡ 가고 싶었던 곳 ${counts.WISH}`}
          </button>
        ))}
      </div>

      <div className="scrollbar-none flex shrink-0 gap-2 overflow-x-auto px-5 py-3">
        <Chip selected={category === null} onClick={() => setCategory(null)} borderClass="border-sand">
          전체
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.value} selected={category === c.value} onClick={() => setCategory(c.value)} borderClass="border-sand">
            {c.emoji} {c.label}
          </Chip>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        <DateMap places={filtered} activeStatus={status} selectedId={selectedId} onSelect={setSelectedId} />
        {isLoading || error ? (
          <div className="absolute inset-x-0 bottom-0 rounded-t-[26px] bg-white shadow-sheet">
            <QueryState isLoading={isLoading} error={error} />
          </div>
        ) : (
          <PlaceSheet places={listed} status={status} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>
    </div>
  )
}
