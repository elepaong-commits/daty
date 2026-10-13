import { BottomSheet } from '../../components/BottomSheet'
import { useUpdateAlbum } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import type { Album } from '../../lib/types'
import { AlbumForm } from './AlbumForm'

export function EditAlbumSheet({ album, onClose }: { album: Album; onClose: () => void }) {
  const updateAlbum = useUpdateAlbum(album.id)
  const t = useT()

  return (
    <BottomSheet title={t.albums.editAlbum} onClose={onClose}>
      <AlbumForm
        album={album}
        submitLabel={t.common.saveChanges}
        isPending={updateAlbum.isPending}
        error={updateAlbum.error}
        onSubmit={({ highlightNote, ...values }) =>
          updateAlbum.mutate({ ...values, highlightNote: highlightNote || null }, { onSuccess: onClose })
        }
      />
    </BottomSheet>
  )
}
