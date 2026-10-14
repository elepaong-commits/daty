import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { useCreateAlbum } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import { AlbumForm } from './AlbumForm'

/** What a finished date fills in up front: its place as the name, its day and its visit checked. */
export interface NewAlbumDraft {
  title: string
  albumDate: string
  recordId: number
}

export function CreateAlbumSheet({ draft, onClose }: { draft?: NewAlbumDraft; onClose: () => void }) {
  const createAlbum = useCreateAlbum()
  const t = useT()
  const navigate = useNavigate()

  return (
    <BottomSheet title={t.albums.newAlbum} onClose={onClose}>
      <AlbumForm
        draft={draft}
        submitLabel={t.albums.create}
        isPending={createAlbum.isPending}
        error={createAlbum.error}
        footer={<p className="rounded-xl bg-sand-soft px-3 py-2 text-[12px] text-muted">{t.albums.uploadHint}</p>}
        onSubmit={({ highlightNote, ...values }) =>
          createAlbum.mutate(
            { ...values, highlightNote: highlightNote || undefined },
            // Photos are added on the album's own screen.
            { onSuccess: (album) => navigate(`/albums/${album.id}`) },
          )
        }
      />
    </BottomSheet>
  )
}
