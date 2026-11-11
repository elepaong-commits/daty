// Saving files to the device. Album files come straight from storage with a "save as" header, so each
// link is opened in a hidden frame: the browser downloads it and the app stays where it is.

const GAP_MS = 600 // browsers drop downloads that start all at once
const CLEANUP_MS = 60_000

/** Starts one download after another; resolves once the last one has been started. */
export async function saveFiles(urls: string[], onProgress?: (started: number) => void) {
  for (const [i, url] of urls.entries()) {
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.src = url
    document.body.append(frame)
    setTimeout(() => frame.remove(), CLEANUP_MS)
    onProgress?.(i + 1)
    if (i < urls.length - 1) await new Promise((resolve) => setTimeout(resolve, GAP_MS))
  }
}

/** Saves data the page already holds. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), CLEANUP_MS)
}
