import { useRef, useState } from 'react'
import { isBlocked, loadForShare, pickFolder, saveFiles, saveMode, saveToFolder, shareFiles, type FileToSave } from './download'

// On phones files go to the share sheet a batch at a time: few enough to hold in memory and for the sheet.
const SHARE_BATCH_FILES = 10
const SHARE_BATCH_BYTES = 150 * 1024 * 1024

export type SaveState =
  | { phase: 'idle' }
  | { phase: 'working'; done: number; total: number }
  /** A batch is in memory; the share sheet can only open from a tap, so `share()` waits for one. */
  | { phase: 'ready'; count: number; done: number; total: number }

/**
 * Saves album files the best way this browser has (see `download.ts`). Call `start` right after the
 * tap that asked for it (a folder picker needs that tap); on phones show a button calling `share`
 * while `state.phase` is `'ready'`.
 */
export function useSaveFiles(load: () => Promise<FileToSave[]>) {
  const [state, setState] = useState<SaveState>({ phase: 'idle' })
  const [error, setError] = useState<Error | null>(null)
  const pending = useRef<{ files: File[]; resolve: (go: boolean) => void } | null>(null)

  async function viaFrames(files: FileToSave[]) {
    await saveFiles(
      files.map((f) => f.url),
      (done) => setState({ phase: 'working', done, total: files.length }),
    )
  }

  async function viaShare(files: FileToSave[]) {
    let batch: File[] = []
    let bytes = 0
    let done = 0
    const offer = async () => {
      setState({ phase: 'ready', count: batch.length, done, total: files.length })
      const go = await new Promise<boolean>((resolve) => (pending.current = { files: batch, resolve }))
      pending.current = null
      batch = []
      bytes = 0
      return go
    }
    for (const file of files) {
      setState({ phase: 'working', done, total: files.length })
      const loaded = await loadForShare(file)
      batch.push(loaded)
      bytes += loaded.size
      done++
      if ((batch.length >= SHARE_BATCH_FILES || bytes >= SHARE_BATCH_BYTES) && !(await offer())) return
    }
    if (batch.length > 0) await offer()
  }

  /** `single`: one file, which a plain download handles better than a folder picker. */
  async function start(files: () => Promise<FileToSave[]> = load, { single = false } = {}) {
    setError(null)
    const best = saveMode()
    const mode = single && best === 'folder' ? 'frames' : best
    try {
      const folder = mode === 'folder' ? await pickFolder() : null
      if (mode === 'folder' && !folder) return
      setState({ phase: 'working', done: 0, total: 0 })
      const list = await files()
      setState({ phase: 'working', done: 0, total: list.length })
      try {
        if (folder) await saveToFolder(folder, list, (done) => setState({ phase: 'working', done, total: list.length }))
        else if (mode === 'share') await viaShare(list)
        else await viaFrames(list)
      } catch (err) {
        if (!isBlocked(err)) throw err
        // Storage refused to be read from the page (CORS): the browser can still download the links.
        await viaFrames(list)
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      pending.current?.resolve(false)
      setState({ phase: 'idle' })
    }
  }

  /** From the "save" tap: opens the share sheet with the batch, then the next batch loads. */
  async function share() {
    const current = pending.current
    if (!current) return
    try {
      // Called before any await so the tap still counts; closing the sheet without saving ends the run.
      current.resolve(await shareFiles(current.files))
    } catch (err) {
      setError(err as Error)
      current.resolve(false)
    }
  }

  const cancel = () => pending.current?.resolve(false)

  return { state, error, start, share, cancel }
}
