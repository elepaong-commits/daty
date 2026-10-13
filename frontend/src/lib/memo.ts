import { MESSAGES, type Messages } from './messages'
import type { TipType } from './types'

// Memos keep tags as language-neutral `{{EAT}}` tokens, so each partner reads them in their own language.
// The textarea shows the spelled-out label instead, converted on the way in and out.

export const TIP_TYPES: TipType[] = ['EAT', 'SEE', 'DO']

const TOKEN = /\{\{(EAT|SEE|DO)\}\}/g

export type MemoPart = { tag: TipType } | { text: string }

export function parseMemo(content: string): MemoPart[] {
  const parts: MemoPart[] = []
  let last = 0
  for (const match of content.matchAll(TOKEN)) {
    if (match.index > last) parts.push({ text: content.slice(last, match.index) })
    parts.push({ tag: match[1] as TipType })
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push({ text: content.slice(last) })
  return parts
}

/** Stored memo → editable text, with tags spelled out in the viewer's language. */
export function decodeMemo(content: string | null | undefined, t: Messages) {
  return (content ?? '').replace(TOKEN, (_, tag: TipType) => t.tips[tag])
}

/** Editable text → stored memo: a tag label in any language becomes its token. */
export function encodeMemo(text: string) {
  let out = text.trim()
  for (const messages of Object.values(MESSAGES)) {
    for (const tag of TIP_TYPES) out = out.replaceAll(messages.tips[tag], `{{${tag}}}`)
  }
  return out
}
