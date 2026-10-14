import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { MemoInput, MemoText } from '../../components/Memo'
import { errorMessage } from '../../lib/api'
import { formatDotted } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { encodeMemo } from '../../lib/memo'
import { useAddPlaceNote, useDeletePlaceNote } from '../../lib/queries'
import type { PlaceNote } from '../../lib/types'

/** The place's memos, newest first, with a composer that can drop tags into a new memo. */
export function PlaceNotes({ placeId, notes }: { placeId: number; notes: PlaceNote[] }) {
  const t = useT()
  const addNote = useAddPlaceNote(placeId)
  const deleteNote = useDeletePlaceNote(placeId)
  const [draft, setDraft] = useState('')
  const content = encodeMemo(draft)
  const error = addNote.error ?? deleteNote.error

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!content || addNote.isPending) return
    addNote.mutate(content, { onSuccess: () => setDraft('') })
  }

  function remove(noteId: number) {
    if (window.confirm(t.place.confirmDeleteNote)) deleteNote.mutate(noteId)
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl bg-white p-3">
      <h3 className="font-display text-[18px]">{t.place.notes}</h3>

      {notes.length === 0 ? (
        <p className="text-[12px] leading-normal text-muted">{t.place.noNotes}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-col gap-1 rounded-xl bg-amber-soft p-3">
              <MemoText content={note.content} className="text-[13px] leading-[1.75] whitespace-pre-line text-amber-ink" />
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>
                  {note.writer ? `${note.writer.nickname} · ` : ''}
                  {formatDotted(new Date(note.createdAt))}
                </span>
                <button
                  type="button"
                  onClick={() => remove(note.id)}
                  disabled={deleteNote.isPending}
                  aria-label={t.place.deleteNote}
                  className="px-1"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <MemoInput label={t.place.newNote} value={draft} onChange={setDraft} placeholder={t.place.notePlaceholder} maxLength={500} />
        {error && <p className="text-[12px] text-coral-strong">{t.common.saveFailed}: {errorMessage(error, t)}</p>}
        <button
          type="submit"
          disabled={!content || addNote.isPending}
          className="h-10 rounded-xl bg-brand-soft text-[13px] font-semibold text-brand-strong disabled:opacity-50"
        >
          {addNote.isPending ? t.common.saving : t.place.addNote}
        </button>
      </form>
    </section>
  )
}
