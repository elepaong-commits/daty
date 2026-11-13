import { describe, expect, it } from 'vitest'
import { decodeMemo, encodeMemo, parseMemo } from './memo'
import { MESSAGES } from './messages'

describe('memo tags', () => {
  it('stores tags as tokens whichever language they were typed in', () => {
    const ko = `${MESSAGES.ko.tips.EAT} 소금빵`
    const ja = `${MESSAGES.ja.tips.SEE} 夜景`
    expect(encodeMemo(`  ${ko}  `)).toBe('{{EAT}} 소금빵')
    expect(encodeMemo(ja)).toBe('{{SEE}} 夜景')
  })

  it('reads tokens back in the reader’s language, and survives a round trip', () => {
    const stored = '{{DO}} 보트 타기 {{EAT}}'
    expect(decodeMemo(stored, MESSAGES.ja)).toBe(`${MESSAGES.ja.tips.DO} 보트 타기 ${MESSAGES.ja.tips.EAT}`)
    expect(encodeMemo(decodeMemo(stored, MESSAGES.ko))).toBe(stored)
    expect(decodeMemo(null, MESSAGES.ko)).toBe('')
  })

  it('splits a memo into text and tags for display', () => {
    expect(parseMemo('a {{SEE}}b')).toEqual([{ text: 'a ' }, { tag: 'SEE' }, { text: 'b' }])
  })
})
