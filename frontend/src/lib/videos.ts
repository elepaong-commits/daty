// Videos go up as shot: browsers can't reliably re-encode them (least of all iOS Safari). What the client
// does prepare is a first-frame JPEG for grids and cards, the length, and when it was recorded.

const THUMBNAIL_EDGE = 800
const THUMBNAIL_QUALITY = 0.8
const LOAD_TIMEOUT_MS = 15_000
const SEEK_TIMEOUT_MS = 5_000
const FRAME_TIMEOUT_MS = 1_000

/** Upload type for a picked video; some pickers leave `type` empty, so the extension decides then. */
export function videoContentType(file: File) {
  if (['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4'
  if (ext === 'webm') return 'video/webm'
  return null
}

export const isVideoFile = (file: File) => file.type.startsWith('video/') || videoContentType(file) !== null

export interface PreparedVideo {
  thumbnail: Blob | null // null if this browser can't decode the video (e.g. HEVC on some desktops)
  durationSec: number | null
  takenAt: string | null
}

export async function prepareVideo(file: File): Promise<PreparedVideo> {
  const [frame, takenAt] = await Promise.all([captureFirstFrame(file), readVideoTakenAt(file)])
  return { ...frame, takenAt }
}

async function captureFirstFrame(file: File) {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  // iOS (every browser there is WebKit) reads these as attributes before it allows an inline muted play.
  video.setAttribute('muted', '')
  video.setAttribute('playsinline', '')
  video.preload = 'auto'
  // WebKit may never decode frames for a video outside the document, so keep it in, just invisible.
  Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0', pointerEvents: 'none' })
  document.body.append(video)
  let durationSec: number | null = null
  try {
    video.src = url
    // iOS Safari treats preload as "metadata" and never fires loadeddata on its own, so start from metadata.
    await waitFor(video, 'loadedmetadata')
    durationSec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null
    // Frame 0 is often black (fade-in) and iOS doesn't paint it until a seek, so step in a little.
    const seekPainted = nextFrame(video)
    video.currentTime = Math.min(0.5, (durationSec ?? 0) / 2)
    // iOS sometimes drops the seek; the play below still gets a frame out.
    await waitFor(video, 'seeked', SEEK_TIMEOUT_MS).catch(() => {})
    await seekPainted
    let canvas = drawFrame(video)
    if (!canvas) {
      // iOS can finish the seek without decoding a frame; a muted play makes it paint one.
      // Low Power Mode refuses even that, but the frame may have arrived meanwhile.
      const playPainted = nextFrame(video)
      await video.play().catch(() => {})
      await playPainted
      video.pause()
      canvas = drawFrame(video)
    }
    const thumbnail = canvas && (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', THUMBNAIL_QUALITY)))
    return { thumbnail, durationSec }
  } catch {
    // Keep the length if only the frame failed.
    return { thumbnail: null, durationSec }
  } finally {
    video.remove()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

/** The current frame on a canvas, or `null` if the video has none decoded yet (iOS then draws nothing). */
function drawFrame(video: HTMLVideoElement) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return null
  const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  // A drawn frame is opaque; a canvas still fully transparent means nothing was painted.
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) return canvas
  return null
}

/** Resolves once the video presents a new frame, or after a short wait where that can't be observed. */
function nextFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, FRAME_TIMEOUT_MS)
    video.requestVideoFrameCallback?.(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function waitFor(video: HTMLVideoElement, event: 'loadedmetadata' | 'seeked', timeoutMs = LOAD_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('timeout')), timeoutMs)
    const onEvent = () => done()
    const onError = () => done(new Error('unreadable'))
    function done(error?: Error) {
      clearTimeout(timer)
      video.removeEventListener(event, onEvent)
      video.removeEventListener('error', onError)
      if (error) reject(error)
      else resolve()
    }
    video.addEventListener(event, onEvent)
    video.addEventListener('error', onError)
  })
}

// MP4 and QuickTime files record their creation time (seconds since 1904, UTC) in moov › mvhd.
// Walking the box headers reads only a few bytes each, wherever moov sits in the file.
const MAC_EPOCH_OFFSET_SEC = 2_082_844_800

async function readVideoTakenAt(file: File) {
  try {
    const moov = await findBox(file, 0, file.size, 'moov')
    const mvhd = moov && (await findBox(file, moov.body, moov.end, 'mvhd'))
    if (!mvhd) return null
    const view = new DataView(await file.slice(mvhd.body, mvhd.body + 16).arrayBuffer())
    const seconds = view.getUint8(0) === 1 ? Number(view.getBigUint64(4)) : view.getUint32(4)
    if (seconds === 0) return null
    return new Date((seconds - MAC_EPOCH_OFFSET_SEC) * 1000).toISOString()
  } catch {
    return null
  }
}

async function findBox(file: File, start: number, end: number, type: string) {
  let offset = start
  while (offset + 8 <= end) {
    const view = new DataView(await file.slice(offset, offset + 16).arrayBuffer())
    let size = view.getUint32(0)
    const name = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7))
    let header = 8
    if (size === 1) {
      size = Number(view.getBigUint64(8))
      header = 16
    } else if (size === 0) {
      size = end - offset
    }
    if (size < header) return null
    if (name === type) return { body: offset + header, end: offset + size }
    offset += size
  }
  return null
}
