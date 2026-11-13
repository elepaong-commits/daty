// Saving files to the device. Album files come straight from storage (R2) under signed links, three ways:
// - a folder the user picks once (desktop Chrome/Edge), each file streamed into it, a few at a time;
// - the share sheet on phones, a batch at a time, so photos land in the photo library;
// - otherwise each "save as" link opens in a hidden frame and the browser downloads it.
// The first two read the files with fetch, which needs GET allowed for the app in the bucket's CORS;
// when that is refused they fall back to the frames.

import { ApiError } from './api'

const GAP_MS = 600 // browsers drop downloads that start all at once
const CLEANUP_MS = 60_000
const FOLDER_CONCURRENCY = 3

export type SaveMode = 'folder' | 'share' | 'frames'

interface DirectoryPickerWindow {
  showDirectoryPicker?: (options?: { mode?: 'readwrite'; id?: string; startIn?: string }) => Promise<FileSystemDirectoryHandle>
}

/** How this browser saves several files best. */
export function saveMode(): SaveMode {
  // A touch device that can share files: into the photo library beats any folder.
  const probe = new File([''], 'probe.jpg', { type: 'image/jpeg' })
  if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [probe] })) return 'share'
  if (typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function') return 'folder'
  return 'frames'
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

/** Asks for the folder to save into; `null` if the user closed the picker. Call it straight from a tap. */
export async function pickFolder() {
  try {
    return await (window as DirectoryPickerWindow).showDirectoryPicker!({ mode: 'readwrite', id: 'daty-save', startIn: 'pictures' })
  } catch (error) {
    if (isAbort(error)) return null
    throw error
  }
}

export interface FileToSave {
  url: string
  filename: string
}

async function fetchFile({ url }: FileToSave) {
  const res = await fetch(url)
  if (!res.ok) throw new ApiError(res.status, `Download failed: ${res.status}`)
  return res
}

/** Streams each file into the folder (never whole in memory, which matters for videos). */
export async function saveToFolder(folder: FileSystemDirectoryHandle, files: FileToSave[], onProgress?: (saved: number) => void) {
  let saved = 0
  let next = 0
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++]!
      const res = await fetchFile(file)
      const handle = await folder.getFileHandle(file.filename, { create: true })
      await res.body!.pipeTo(await handle.createWritable())
      onProgress?.(++saved)
    }
  }
  await Promise.all(Array.from({ length: Math.min(FOLDER_CONCURRENCY, files.length) }, worker))
}

/** Reads a file into memory for the share sheet. */
export async function loadForShare(file: FileToSave) {
  const blob = await (await fetchFile(file)).blob()
  return new File([blob], file.filename, { type: blob.type })
}

/** Opens the share sheet with the files; `false` if the user closed it. Call it straight from a tap. */
export async function shareFiles(files: File[]) {
  try {
    await navigator.share({ files })
    return true
  } catch (error) {
    if (isAbort(error)) return false
    throw error
  }
}

/** The fetch was refused before any answer: most likely the bucket's CORS doesn't allow GET yet. */
export const isBlocked = (error: unknown) => error instanceof TypeError

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
