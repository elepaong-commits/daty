import { useState } from 'react'
import plusIcon from '../../assets/icons/plus.svg'
import { QueryState } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useAlbums } from '../../lib/queries'
import { AlbumCard } from './AlbumCard'
import { CreateAlbumSheet } from './CreateAlbumSheet'

export function AlbumsPage() {
  const { data: albums = [], isLoading, error } = useAlbums()
  const [sheetOpen, setSheetOpen] = useState(false)
  const photoTotal = albums.reduce((sum, a) => sum + a.photoCount, 0)
  const [featured, ...rest] = albums

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <ScreenHeader
          eyebrow="추억 갤러리"
          title="데이트 앨범"
          actions={
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-white"
            >
              <img src={plusIcon} alt="" width={16} height={16} />새 앨범
            </button>
          }
        >
          <p className="text-[12px] leading-normal text-muted">
            📷 사진 여러 장을 한 번에 선택하면 날짜·장소별로 묶어 드려요 · 앨범 {albums.length}개 · 사진 {photoTotal}장
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
                <span className="text-[14px] font-bold text-brand-strong">새 앨범 만들기</span>
                <span className="text-center text-[11px] leading-[1.375] text-muted">
                  사진 여러 장을
                  <br />한 번에 선택하세요
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {sheetOpen && <CreateAlbumSheet onClose={() => setSheetOpen(false)} />}
    </div>
  )
}
