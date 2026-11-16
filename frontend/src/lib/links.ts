/**
 * `value` when it is an http(s) link, otherwise `undefined`. For links that come from saved data or the
 * user's typing, so a `javascript:` URL never ends up in an `href`.
 */
export function webLink(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}
