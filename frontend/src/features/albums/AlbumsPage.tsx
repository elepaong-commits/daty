import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import plusIcon from '../../assets/icons/plus.svg'
import { QueryState } from '../../components/Field'
import { PixelSprite } from '../../components/PixelSprite'
import { ScreenHeader } from '../../components/ScreenHeader'
import { RISE_IN, riseDelay } from '../../lib/motion'
import { useAlbums } from '../../lib/queries'
import type { AlbumSummary } from '../../lib/types'
import { MemoriesToday } from '../memories/MemoriesToday'
import { AlbumCard } from './AlbumCard'
import { CreateAlbumSheet, type NewAlbumDraft } from './CreateAlbumSheet'
import { useT } from '../../lib/i18n'
import { useIsRetro } from '../../lib/theme'
import { useScrollMemory } from '../../lib/useScrollMemory'

export function AlbumsPage() {
  const t = useT()
  const retro = useIsRetro()
  const { data: albums = [], isLoading, error } = useAlbums()
  // A date finished on the calendar arrives with its album already filled in.
  const location = useLocation()
  const navigate = useNavigate()
  const [draft, setDraft] = useState((location.state as { newAlbum?: NewAlbumDraft } | null)?.newAlbum)
  const [sheetOpen, setSheetOpen] = useState(draft !== undefined)
  // Use the draft once, so going back here later doesn't reopen it.
  useEffect(() => {
    if (location.state) navigate('.', { replace: true, state: null })
  }, [location.state, navigate])
  const photoTotal = albums.reduce((sum, a) => sum + a.photoCount, 0)
  const [query, setQuery] = useState('')
  const [year, setYear] = useState<number | null>(null)
  const years = [...new Set(albums.map(yearOf))]
  const shown = albums.filter((a) => (year === null || yearOf(a) === year) && matches(a, query))
  const filtering = query.trim() !== '' || year !== null
  // Newest year first, as the albums come.
  const groups = [...new Set(shown.map(yearOf))].map((y) => ({ year: y, albums: shown.filter((a) => yearOf(a) === y) }))
  // Coming back from an album lands where its card was.
  const scroller = useScrollMemory<HTMLDivElement>(!isLoading)
  const [scrolled, setScrolled] = useState(false)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 400)}
        className="scrollbar-none min-h-0 flex-1 overflow-y-auto"
      >
        <div className="md:mx-auto md:max-w-[1240px] md:px-5">
        <ScreenHeader
          eyebrow={t.albums.eyebrow}
          title={t.albums.title}
          actions={
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to="/recap"
                className="ui-btn-thin flex h-10 items-center rounded-full bg-surface px-3.5 text-[14px] font-semibold text-brand-text retro:h-9 retro:px-3 retro:text-[12px] retro:text-brand-text"
              >
                {t.albums.recap}
              </Link>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="ui-btn-thin flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand-strong px-4 text-[14px] font-semibold text-white hover:bg-brand-deep retro:h-9 retro:px-3 retro:text-[12px]"
              >
                {retro ? <PixelSprite name="plus" scale={2} /> : <img src={plusIcon} alt="" width={16} height={16} />}
                {t.albums.newAlbum}
              </button>
            </div>
          }
        >
          <p className="text-[12px] leading-normal text-muted">
            {t.albums.summary(albums.length, photoTotal)}
          </p>
        </ScreenHeader>

        <div className="flex flex-col gap-5 px-4 pt-2 pb-8 md:px-5 md:pb-12">
          <MemoriesToday />
          <QueryState isLoading={isLoading} error={error} />
          {!isLoading && !error && albums.length > 0 && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.albums.search}
                aria-label={t.albums.search}
                className="ui-search !mt-0 md:max-w-[360px]"
              />
              {years.length > 1 && (
                <div className="scrollbar-none flex gap-2 overflow-x-auto">
                  {[null, ...years].map((y) => (
                    <button key={y ?? 'all'} type="button" aria-pressed={year === y} onClick={() => setYear(y)} className="ui-chip">
                      {y === null ? t.albums.allYears : t.albums.year(y)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isLoading && !error && filtering && shown.length === 0 && (
            <p className="ui-empty rounded-2xl bg-surface/60 py-8 text-center text-[13px] text-muted">{t.albums.noResults}</p>
          )}
          {!isLoading && !error && groups.map((group, g) => (
            <section key={group.year} className="flex flex-col gap-3">
              {years.length > 1 && <h2 className="font-display text-[18px] retro:text-[15px]">{t.albums.year(group.year)}</h2>}
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-x-6 md:gap-y-8 xl:grid-cols-4">
                {group.albums.map((album, i) => (
                  <AlbumCard key={album.id} album={album} className={RISE_IN} style={riseDelay(i)} />
                ))}
                {g === 0 && !filtering && <NewAlbumCard index={group.albums.length} onClick={() => setSheetOpen(true)} />}
              </div>
            </section>
          ))}
          {!isLoading && !error && albums.length === 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-x-6 md:gap-y-8 xl:grid-cols-4">
              <NewAlbumCard index={0} onClick={() => setSheetOpen(true)} />
            </div>
          )}
        </div>
        </div>
      </div>

      {scrolled && (
        <button
          type="button"
          aria-label={t.albums.toTop}
          onClick={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="ui-btn-thin absolute right-4 bottom-4 z-10 flex size-11 items-center justify-center rounded-full bg-brand-strong text-white shadow-lg hover:bg-brand-deep md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}

      <AnimatePresence>
        {sheetOpen && (
          <CreateAlbumSheet
            draft={draft}
            onClose={() => {
              setSheetOpen(false)
              setDraft(undefined)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

const yearOf = (album: AlbumSummary) => Number(album.albumDate.slice(0, 4))

/** Search over what a card shows: the title, the places (names and addresses) and the must-see note. */
function matches(album: AlbumSummary, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [album.title, album.highlightNote, ...album.places.flatMap((p) => [p.name, p.address])].some((text) =>
    text?.toLowerCase().includes(q),
  )
}

function NewAlbumCard({ index, onClick }: { index: number; onClick: () => void }) {
  const t = useT()
  const retro = useIsRetro()
  return (
    <button
      type="button"
      onClick={onClick}
      style={riseDelay(index)}
      className={`flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/50 p-4 hover:bg-brand-soft ui-box-thin retro:m-0.5 retro:bg-cream retro:bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(0_168_150/0.07)_6px_12px)] retro:hover:bg-brand-soft ${RISE_IN}`}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-strong text-[24px] text-white retro:size-10 retro:pixel-outline retro:pixel-thin">
        {retro ? <PixelSprite name="plus" scale={3} /> : '+'}
      </span>
      <span className="text-[14px] font-bold text-brand-text">{t.albums.createCard}</span>
      <span className="text-center text-[11px] leading-[1.375] text-muted">
        {t.albums.createCardHint[0]}
        <br />
        {t.albums.createCardHint[1]}
      </span>
    </button>
  )
}
