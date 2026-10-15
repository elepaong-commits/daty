import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { errorMessage } from '../../lib/api'
import { useDeleteAlbum, useUpdateAlbum } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import type { Album } from '../../lib/types'
import { AlbumForm } from './AlbumForm'

export function EditAlbumSheet({ album, onClose }: { album: Album; onClose: () => void }) {
  const updateAlbum = useUpdateAlbum(album.id)
  const deleteAlbum = useDeleteAlbum(album.id)
  const t = useT()
  const navigate = useNavigate()

  function remove() {
    if (!window.confirm(t.albums.confirmDeleteAlbum(album.photoCount))) return
    deleteAlbum.mutate(undefined, { onSuccess: () => navigate('/albums', { replace: true }) })
  }

  return (
    <BottomSheet title={t.albums.editAlbum} onClose={onClose}>
      <AlbumForm
        album={album}
        submitLabel={t.common.saveChanges}
        isPending={updateAlbum.isPending}
        error={updateAlbum.error}
        footer={
          deleteAlbum.error && (
            <p className="text-[12px] text-coral-strong">
              {t.common.deleteFailed}: {errorMessage(deleteAlbum.error, t)}
            </p>
          )
        }
        onSubmit={({ highlightNote, ...values }) =>
          updateAlbum.mutate({ ...values, highlightNote: highlightNote || null }, { onSuccess: onClose })
        }
      />
      <button
        type="button"
        onClick={remove}
        disabled={deleteAlbum.isPending || updateAlbum.isPending}
        className="mx-auto mt-4 block text-[12px] text-muted underline disabled:opacity-50"
      >
        {t.albums.deleteAlbum}
      </button>
    </BottomSheet>
  )
}
