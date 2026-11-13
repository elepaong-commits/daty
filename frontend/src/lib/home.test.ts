import { expect, it } from 'vitest'
import { homeOf } from './home'

it('leans the map towards the country of the device’s time zone, else its language', () => {
  expect(homeOf('Asia/Tokyo', 'ko').region).toBe('JP')
  expect(homeOf('Asia/Seoul', 'ja').region).toBe('KR')
  expect(homeOf('Europe/Paris', 'ja').region).toBe('JP')
  expect(homeOf(undefined, 'ko').region).toBe('KR')
})
