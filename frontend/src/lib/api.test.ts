import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, ImageError, errorMessage, withRetry } from './api'
import { MESSAGES } from './messages'

const t = MESSAGES.ko

describe('errorMessage', () => {
  it('uses the message for a known code', () => {
    expect(errorMessage(new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS'), t)).toBe(t.errors.INVALID_CREDENTIALS)
  })

  it('never shows the raw English text', () => {
    expect(errorMessage(new ApiError(400, 'Invalid request', 'INVALID_REQUEST'), t)).toBe(t.failures.invalid)
    expect(errorMessage(new ApiError(404, 'Not Found'), t)).toBe(t.failures.notFound)
    expect(errorMessage(new ApiError(502, 'Bad Gateway'), t)).toBe(t.failures.server)
    expect(errorMessage(new ApiError(0, 'R2 upload failed: network error'), t)).toBe(t.failures.network)
    expect(errorMessage(new TypeError('Failed to fetch'), t)).toBe(t.failures.network)
    expect(errorMessage(new Error('whatever'), MESSAGES.ja)).toBe(MESSAGES.ja.failures.unknown)
  })

  it('names the file a photo error is about', () => {
    expect(errorMessage(new ImageError('a.heic', 'IMAGE_UNREADABLE'), t)).toBe(`a.heic: ${t.errors.IMAGE_UNREADABLE}`)
  })
})

describe('withRetry', () => {
  afterEach(() => vi.useRealTimers())

  it('tries again after a dropped connection or a server error', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValueOnce(new ApiError(503, 'x')).mockResolvedValue('ok')
    await expect(withRetry(fn, [0, 0])).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('gives up after the last pause', async () => {
    const fn = vi.fn().mockRejectedValue(new ApiError(500, 'x'))
    await expect(withRetry(fn, [0, 0])).rejects.toBeInstanceOf(ApiError)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not repeat a request the server refused', async () => {
    const fn = vi.fn().mockRejectedValue(new ApiError(403, 'expired'))
    await expect(withRetry(fn, [0, 0])).rejects.toMatchObject({ status: 403 })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
