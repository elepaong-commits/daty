import { BottomSheet } from '../../components/BottomSheet'
import { QueryState } from '../../components/Field'
import { formatDotted, parseDateOnly } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { useAlbums } from '../../lib/queries'

/** Picks the album the selected photos go to. */
export function MovePhotosSheet({
  currentId,
  count,
  busy,
  onPick,
  onClose,
}: {
  currentId: number
  count: number
  busy: boolean
  onPick: (albumId: number) => void
  onClose: () => void
}) {
  const t = useT()
  const { data: albums = [], isLoading, error } = useAlbums()
  const others = albums.filter((a) => a.id !== currentId)

  return (
    <BottomSheet title={t.albums.moveTitle(count)} onClose={onClose}>
      {isLoading || error ? (
        <QueryState isLoading={isLoading} error={error} />
      ) : others.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted">{t.albums.moveNoOther}</p>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {others.map((album) => (
            <li key={album.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(album.id)}
                className="ui-btn-thin flex w-full items-center gap-3 rounded-2xl border border-card-border p-2.5 text-left disabled:opacity-50 retro:border-0"
              >
                {album.coverPhoto?.thumbnailUrl ? (
                  <img src={album.coverPhoto.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-xl object-cover retro:rounded-none" />
                ) : (
                  <span className="size-12 shrink-0 rounded-xl bg-sand-soft retro:rounded-none" />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-semibold">{album.title}</span>
                  <span className="text-[12px] text-muted">
                    {formatDotted(parseDateOnly(album.albumDate))} · {t.common.photos(album.photoCount)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  )
}
