import { expect, it } from 'vitest'
import { milestonesOn } from './anniversary'

it('marks every 100th day (the first day is day 1) and each year', () => {
  expect(milestonesOn('2026-01-01', '2026-04-10')).toEqual([{ kind: 'days', count: 100 }])
  expect(milestonesOn('2026-01-01', '2026-04-09')).toEqual([])
  expect(milestonesOn('2025-08-23', '2026-08-23')).toEqual([{ kind: 'years', count: 1 }])
  expect(milestonesOn('2025-08-23', '2025-08-23')).toEqual([])
  expect(milestonesOn('2023-04-12', '2025-04-12')).toEqual([{ kind: 'years', count: 2 }])
  expect(milestonesOn('2024-01-01', '2026-09-26')).toEqual([{ kind: 'days', count: 1000 }])
})
