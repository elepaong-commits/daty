import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import plusIcon from '../../assets/icons/plus.svg'
import { QueryState } from '../../components/Field'
import { PixelSprite } from '../../components/PixelSprite'
import { ScreenHeader } from '../../components/ScreenHeader'
import { RISE_IN, riseDelay } from '../../lib/motion'
import { useAlbums } from '../../lib/queries'
import { AlbumCard } from './AlbumCard'
import { CreateAlbumSheet, type NewAlbumDraft } from './CreateAlbumSheet'
import { useT } from '../../lib/i18n'
import { useIsRetro } from '../../lib/theme'

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
  const [featured, ...rest] = albums

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className="lg:mx-auto lg:max-w-[1240px] lg:px-5">
        <ScreenHeader
          eyebrow={t.albums.eyebrow}
          title={t.albums.title}
          actions={
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="ui-btn-thin flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-white hover:bg-brand-strong retro:h-9 retro:px-3 retro:text-[12px]"
            >
              {retro ? <PixelSprite name="plus" scale={2} /> : <img src={plusIcon} alt="" width={16} height={16} />}
              {t.albums.newAlbum}
            </button>
          }
        >
          <p className="text-[12px] leading-normal text-muted">
            {t.albums.summary(albums.length, photoTotal)}
          </p>
        </ScreenHeader>

        <div className="flex flex-col gap-5 px-4 pt-2 pb-8 lg:px-5 lg:pb-12">
          <QueryState isLoading={isLoading} error={error} />
          {/* Phones: the latest album full width, then two columns. Desktop: one grid with the latest album at 2×2. */}
          {!isLoading && !error && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-8 xl:grid-cols-4">
              {featured && (
                <div className={`col-span-2 lg:row-span-2 ${RISE_IN}`}>
                  <AlbumCard album={featured} size="large" />
                </div>
              )}
              {rest.map((album, i) => (
                <AlbumCard key={album.id} album={album} size="small" className={RISE_IN} style={riseDelay(i + 1)} />
              ))}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                style={riseDelay(rest.length + 1)}
                className={`flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/50 p-4 hover:bg-brand-soft lg:max-h-[240px] ${RISE_IN}`}
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-brand text-[24px] text-white retro:size-10 retro:pixel-outline retro:pixel-thin">
                  {retro ? <PixelSprite name="plus" scale={3} /> : '+'}
                </span>
                <span className="text-[14px] font-bold text-brand-strong">{t.albums.createCard}</span>
                <span className="text-center text-[11px] leading-[1.375] text-muted">
                  {t.albums.createCardHint[0]}
                  <br />
                  {t.albums.createCardHint[1]}
                </span>
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

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
