const EDGE = 1024 * 1024

/**
 * SHA-256 of a file's size and its first and last 1MB, as hex: enough to spot the same photo or video picked twice
 * without reading a whole video. Null where the browser can't hash (plain-http dev on a phone).
 */
export async function fileFingerprint(file: File): Promise<string | null> {
  if (!crypto.subtle) return null
  try {
    const parts: BlobPart[] = [String(file.size), file.slice(0, EDGE)]
    if (file.size > EDGE) parts.push(file.slice(Math.max(EDGE, file.size - EDGE)))
    const digest = await crypto.subtle.digest('SHA-256', await new Blob(parts).arrayBuffer())
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}
