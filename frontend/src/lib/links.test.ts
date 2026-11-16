import { describe, expect, it } from 'vitest'
import { webLink } from './links'

describe('webLink', () => {
  it('keeps http(s) links', () => {
    expect(webLink('https://maps.app.goo.gl/abc')).toBe('https://maps.app.goo.gl/abc')
    expect(webLink('http://example.com')).toBe('http://example.com')
  })

  it('drops other schemes and junk', () => {
    expect(webLink('javascript:alert(1)')).toBeUndefined()
    expect(webLink(' JavaScript:alert(1)')).toBeUndefined()
    expect(webLink('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(webLink('maps.app.goo.gl/abc')).toBeUndefined()
    expect(webLink('')).toBeUndefined()
    expect(webLink(null)).toBeUndefined()
  })
})
