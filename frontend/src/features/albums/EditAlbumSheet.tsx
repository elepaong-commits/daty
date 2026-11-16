import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { errorMessage } from '../../lib/api'
import { useConfirm } from '../../lib/confirm'
import { useDeleteAlbum, useUpdateAlbum } from '../../lib/queries'
import { useT } from '../../lib/i18n'
import type { Album } from '../../lib/types'
import { AlbumForm } from './AlbumForm'

export function EditAlbumSheet({ album, onClose }: { album: Album; onClose: () => void }) {
  const updateAlbum = useUpdateAlbum(album.id)
  const deleteAlbum = useDeleteAlbum(album.id)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const t = useT()

  async function remove() {
    const sure = await confirm({
      title: t.albums.confirmDeleteAlbum,
      message: t.albums.confirmDeleteAlbumBody(album.photos.length),
      confirmLabel: t.common.delete,
      danger: true,
    })
    if (sure) deleteAlbum.mutate(undefined, { onSuccess: () => navigate('/albums', { replace: true }) })
  }

  return (
    <BottomSheet title={t.albums.editAlbum} onClose={onClose}>
      <AlbumForm
        album={album}
        submitLabel={t.common.saveChanges}
        isPending={updateAlbum.isPending || deleteAlbum.isPending}
        error={updateAlbum.error}
        onSubmit={({ highlightNote, ...values }) =>
          updateAlbum.mutate({ ...values, highlightNote: highlightNote || null }, { onSuccess: onClose })
        }
      />
      {deleteAlbum.error && <p className="pt-3 text-[12px] text-coral-strong">{errorMessage(deleteAlbum.error, t)}</p>}
      <button
        type="button"
        onClick={remove}
        disabled={updateAlbum.isPending || deleteAlbum.isPending}
        className="mx-auto mt-4 block text-[12px] text-muted underline disabled:opacity-50"
      >
        {t.albums.deleteAlbum}
      </button>
    </BottomSheet>
  )
}
