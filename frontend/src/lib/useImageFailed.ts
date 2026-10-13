import { useState } from 'react'

/** Remembers which URL failed so a new URL (e.g. the next day's signature) gets another try. */
export function useImageFailed(src: string | null | undefined) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  return { failed: !!src && failedSrc === src, onError: () => setFailedSrc(src ?? null) }
}
