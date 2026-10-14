import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import plusIcon from '../../assets/icons/plus.svg'
import { QueryState } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useAlbums } from '../../lib/queries'
import { AlbumCard } from './AlbumCard'
import { CreateAlbumSheet, type NewAlbumDraft } from './CreateAlbumSheet'
import { useT } from '../../lib/i18n'

export function AlbumsPage() {
  const t = useT()
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
        <ScreenHeader
          eyebrow={t.albums.eyebrow}
          title={t.albums.title}
          actions={
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-white"
            >
              <img src={plusIcon} alt="" width={16} height={16} />{t.albums.newAlbum}
            </button>
          }
        >
          <p className="text-[12px] leading-normal text-muted">
            {t.albums.summary(albums.length, photoTotal)}
          </p>
        </ScreenHeader>

        <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
          <QueryState isLoading={isLoading} error={error} />
          {featured && <AlbumCard album={featured} size="large" />}
          {!isLoading && !error && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {rest.map((album) => (
                <AlbumCard key={album.id} album={album} size="small" />
              ))}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/50 p-4"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-brand text-[24px] text-white">+</span>
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

      {sheetOpen && (
        <CreateAlbumSheet
          draft={draft}
          onClose={() => {
            setSheetOpen(false)
            setDraft(undefined)
          }}
        />
      )}
    </div>
  )
}
