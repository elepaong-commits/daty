import { useId, useRef } from 'react'
import { TIP_CLASSES } from '../lib/categories'
import { useT } from '../lib/i18n'
import { parseMemo, TIP_TYPES } from '../lib/memo'
import { inputClass } from './Field'

/** A stored memo with its `{{EAT}}` tokens drawn as colored tags. */
export function MemoText({ content, className = '' }: { content: string; className?: string }) {
  const t = useT()
  return (
    <p className={`ui-prose ${className}`}>
      {parseMemo(content).map((part, i) =>
        'tag' in part ? (
          <span key={i} className={`mr-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold retro:font-pixel ${TIP_CLASSES[part.tag]}`}>
            {t.tips[part.tag]}
          </span>
        ) : (
          part.text
        ),
      )}
    </p>
  )
}

interface MemoInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength: number
  className?: string
}

/** Memo textarea with tag buttons that insert a tag at the cursor. Encode with `encodeMemo` before saving. */
export function MemoInput({ label, value, onChange, placeholder, maxLength, className = '' }: MemoInputProps) {
  const t = useT()
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)

  function insert(tagLabel: string) {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const before = value.slice(0, start)
    const text = `${before && !/\s$/.test(before) ? ' ' : ''}${tagLabel} `
    if (value.length - (end - start) + text.length > maxLength) return
    onChange(before + text + value.slice(end))
    const caret = before.length + text.length
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-[12px] leading-normal font-semibold text-muted">
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={3}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} ui-prose h-[85px] resize-none py-2.5 leading-normal`}
      />
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5" role="group" aria-label={t.memo.addTag}>
        <span className="text-[11px] text-muted">{t.memo.addTag}</span>
        {TIP_TYPES.map((tag) => (
          <button
            key={tag}
            type="button"
            // Keep the textarea's cursor where it was.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(t.tips[tag])}
            className={`rounded-lg px-2 py-1 text-[11px] leading-normal font-bold ${TIP_CLASSES[tag]}`}
          >
            + {t.tips[tag]}
          </button>
        ))}
      </div>
    </div>
  )
}
