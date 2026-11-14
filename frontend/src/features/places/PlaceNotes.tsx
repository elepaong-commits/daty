import { Pencil, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { FeedbackPanel } from '../../components/FeedbackPanel'
import { MemoInput, MemoText } from '../../components/Memo'
import { errorMessage } from '../../lib/api'
import { formatDotted } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { decodeMemo, encodeMemo } from '../../lib/memo'
import { useAddPlaceNote, useDeletePlaceNote, useMe, useUpdatePlaceNote } from '../../lib/queries'
import type { PlaceNote } from '../../lib/types'
import { useConfirm } from '../../lib/confirm'

/** The place's memos, newest first, with a composer that can drop tags into a new memo. */
export function PlaceNotes({ placeId, notes }: { placeId: number; notes: PlaceNote[] }) {
  const t = useT()
  const confirm = useConfirm()
  const addNote = useAddPlaceNote(placeId)
  const deleteNote = useDeletePlaceNote(placeId)
  const myId = useMe().data?.user.id
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const content = encodeMemo(draft)
  const error = addNote.error ?? deleteNote.error

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!content || addNote.isPending) return
    addNote.mutate(content, { onSuccess: () => setDraft('') })
  }

  async function remove(noteId: number) {
    if (await confirm({ title: t.place.confirmDeleteNote, confirmLabel: t.common.delete, danger: true })) deleteNote.mutate(noteId)
  }

  return (
    <section className="ui-box-thin flex flex-col gap-2.5 rounded-2xl bg-surface p-3">
      <h3 className="font-display text-[18px]">{t.place.notes}</h3>

      {notes.length === 0 ? (
        <p className="text-[12px] leading-normal text-muted">{t.place.noNotes}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-col gap-1 rounded-xl bg-amber-soft p-3 retro:mx-0.5 retro:pixel-outline retro:pixel-thin retro:[--pixel-border:var(--color-amber)]">
              {editingId === note.id ? (
                <NoteEditor placeId={placeId} note={note} onDone={() => setEditingId(null)} />
              ) : (
                <MemoText content={note.content} className="text-[13px] leading-[1.75] whitespace-pre-line text-amber-ink" />
              )}
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>
                  {note.writer ? `${note.writer.nickname} · ` : ''}
                  {formatDotted(new Date(note.createdAt))}
                </span>
                {/* Like comments, a memo is the writer's to change; one left by a deleted account either can clear. */}
                <span className="flex">
                  {note.writer?.id === myId && editingId !== note.id && (
                    <button type="button" onClick={() => setEditingId(note.id)} aria-label={t.place.editNote} className="px-1">
                      <Pencil size={13} strokeWidth={1.75} />
                    </button>
                  )}
                  {(note.writer === null || note.writer.id === myId) && (
                    <button
                      type="button"
                      onClick={() => remove(note.id)}
                      disabled={deleteNote.isPending}
                      aria-label={t.place.deleteNote}
                      className="px-1"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </span>
              </div>
              <FeedbackPanel target={{ kind: 'note', placeId, noteId: note.id }} feedback={note} collapsible />
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
          className="ui-btn-thin h-10 rounded-xl bg-brand-soft text-[13px] font-semibold text-brand-text disabled:opacity-50 retro:mb-1"
        >
          {addNote.isPending ? t.common.saving : t.place.addNote}
        </button>
      </form>
    </section>
  )
}

/** A memo rewritten in place, tags shown in the reader's language as in the composer. */
function NoteEditor({ placeId, note, onDone }: { placeId: number; note: PlaceNote; onDone: () => void }) {
  const t = useT()
  const update = useUpdatePlaceNote(placeId)
  const [text, setText] = useState(() => decodeMemo(note.content, t))
  const content = encodeMemo(text)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!content || update.isPending) return
    if (content === note.content) return onDone()
    update.mutate({ noteId: note.id, content }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <MemoInput label={t.place.editNote} value={text} onChange={setText} maxLength={500} />
      {update.error && <p className="text-[12px] text-coral-strong">{t.common.saveFailed}: {errorMessage(update.error, t)}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="ui-btn-thin h-9 flex-1 rounded-xl bg-surface text-[13px] font-semibold retro:mb-1">
          {t.common.cancel}
        </button>
        <button
          type="submit"
          disabled={!content || update.isPending}
          className="ui-btn-thin h-9 flex-1 rounded-xl bg-brand-strong text-[13px] font-semibold text-white disabled:opacity-50 retro:mb-1"
        >
          {update.isPending ? t.common.saving : t.common.save}
        </button>
      </div>
    </form>
  )
}
