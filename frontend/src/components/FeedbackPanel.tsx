import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/api'
import { useT } from '../lib/i18n'
import { useFeedback, useMe } from '../lib/queries'
import type { Feedback, FeedbackTarget } from '../lib/types'

/** The emoji the backend accepts (backend/src/lib/feedback.ts). */
const EMOJIS = ['❤️', '😍', '😂', '🥹', '👍', '🔥']

interface Props {
  target: FeedbackTarget
  feedback: Feedback
  /** `dark` sits on the photo viewer's black, `light` on a memo card. */
  tone?: 'light' | 'dark'
  /** Start with the comments folded behind a "comments N" button (memo cards). */
  collapsible?: boolean
}

/** Emoji reactions and comments the two leave on a photo or a place memo. */
export function FeedbackPanel({ target, feedback, tone = 'light', collapsible = false }: Props) {
  const t = useT()
  const myId = useMe().data?.user.id
  const { react, comment, removeComment } = useFeedback(target)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(!collapsible || feedback.comments.length > 0)
  const mine = feedback.reactions.find((r) => r.userId === myId)?.emoji
  const error = react.error ?? comment.error ?? removeComment.error
  const dark = tone === 'dark'

  function submit(e: FormEvent) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || comment.isPending) return
    comment.mutate(content, { onSuccess: () => setDraft('') })
  }

  function remove(commentId: number) {
    if (window.confirm(t.feedback.confirmDelete)) removeComment.mutate(commentId)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {EMOJIS.map((emoji) => {
          const count = feedback.reactions.filter((r) => r.emoji === emoji).length
          const isMine = mine === emoji
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => react.mutate(isMine ? null : emoji)}
              disabled={react.isPending}
              aria-pressed={isMine}
              aria-label={t.feedback.react(emoji)}
              className={`flex h-8 items-center gap-0.5 rounded-full px-2 text-[15px] leading-none transition-opacity ${
                isMine
                  ? dark ? 'bg-white text-ink' : 'bg-brand-soft ring-1 ring-brand'
                  : dark ? 'bg-white/15' : 'bg-white/70'
              } ${count === 0 ? 'opacity-55 hover:opacity-100' : ''}`}
            >
              {emoji}
              {count > 0 && <span className="text-[11px] font-semibold tabular-nums">{count}</span>}
            </button>
          )
        })}
        {collapsible && !open && (
          <button type="button" onClick={() => setOpen(true)} className="ml-auto h-8 px-1 text-[12px] font-semibold text-muted">
            {t.feedback.open(feedback.comments.length)}
          </button>
        )}
      </div>

      {open && (
        <>
          {feedback.comments.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {feedback.comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[13px] leading-normal">
                  <p className="ui-prose min-w-0 flex-1 break-words whitespace-pre-line">
                    {c.writer && <span className={`pr-1.5 font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{c.writer.nickname}</span>}
                    <span className={dark ? 'text-white/85' : 'text-ink'}>{c.content}</span>
                  </p>
                  {c.writer?.id === myId && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      disabled={removeComment.isPending}
                      aria-label={t.feedback.deleteComment}
                      className={`shrink-0 px-1 py-0.5 ${dark ? 'text-white/60' : 'text-muted'}`}
                    >
                      <X size={13} strokeWidth={1.75} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={submit} className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={300}
              placeholder={t.feedback.placeholder}
              aria-label={t.feedback.placeholder}
              className={`ui-prose h-9 min-w-0 flex-1 rounded-full px-3.5 text-[13px] outline-none retro:rounded-none ${
                dark ? 'bg-white/15 text-white placeholder:text-white/50' : 'bg-white text-ink placeholder:text-faint'
              }`}
            />
            <button
              type="submit"
              disabled={!draft.trim() || comment.isPending}
              className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-40 retro:rounded-none ${
                dark ? 'bg-white text-ink' : 'bg-brand text-white'
              }`}
            >
              {t.feedback.send}
            </button>
          </form>
        </>
      )}
      {error && <p className={`text-[12px] ${dark ? 'text-coral' : 'text-coral-strong'}`}>{errorMessage(error, t)}</p>}
    </div>
  )
}
