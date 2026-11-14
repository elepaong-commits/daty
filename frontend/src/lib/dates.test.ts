import { describe, expect, it } from 'vitest'
import { daysTogether, formatDuration, monthGrid, rangesOverlap } from './dates'

describe('dates', () => {
  it('counts the anniversary itself as day 1', () => {
    expect(daysTogether('2026-11-13', new Date(2026, 10, 13, 23))).toBe(1)
    expect(daysTogether('2026-01-01', new Date(2026, 3, 10))).toBe(100)
  })

  it('lays a month out in whole Sunday-first weeks', () => {
    const weeks = monthGrid(new Date(2026, 10, 1)) // November 2026 starts on a Sunday
    expect(weeks).toHaveLength(5)
    expect(weeks[0]![0]!.getDate()).toBe(1)
    expect(weeks.flat().every((d) => d.getDay() === weeks.flat().indexOf(d) % 7)).toBe(true)
  })

  it('treats touching day ranges as overlapping', () => {
    expect(rangesOverlap('2026-09-10', '2026-09-12', '2026-09-12', '2026-09-13')).toBe(true)
    expect(rangesOverlap('2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13')).toBe(false)
  })

  it('formats video lengths', () => {
    expect(formatDuration(12.4)).toBe('0:12')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})
