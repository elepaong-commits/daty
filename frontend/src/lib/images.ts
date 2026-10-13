import { ImageError } from './api'

// Phone originals run 5–10MB; albums only need screen-sized images, so photos are shrunk before upload.
const MAX_EDGE = 2048
const JPEG_QUALITY = 0.85
// Grids and album cards get a small copy (~100KB) so a page of photos doesn't pull full-size images.
const THUMBNAIL_EDGE = 800
const THUMBNAIL_QUALITY = 0.8

export interface PreparedImage {
  blob: Blob
  thumbnail: Blob
  contentType: 'image/jpeg'
  takenAt: string | null // EXIF capture time, ISO
}

/** Shrinks a picked photo to a ≤2048px JPEG plus a ≤800px thumbnail and reads when it was taken. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  // Read EXIF from the original: re-encoding through a canvas drops it.
  const [bitmap, takenAt] = await Promise.all([
    // Rotated per EXIF orientation by default.
    createImageBitmap(file).catch(() => {
      throw new ImageError(file.name, 'IMAGE_UNREADABLE')
    }),
    readTakenAt(file),
  ])
  try {
    const [blob, thumbnail] = await Promise.all([
      encodeJpeg(bitmap, MAX_EDGE, JPEG_QUALITY),
      encodeJpeg(bitmap, THUMBNAIL_EDGE, THUMBNAIL_QUALITY),
    ])
    if (!blob || !thumbnail) throw new ImageError(file.name, 'IMAGE_ENCODE_FAILED')
    return { blob, thumbnail, contentType: 'image/jpeg', takenAt }
  } finally {
    bitmap.close()
  }
}

/** Draws the image at most `maxEdge` px on its long side and encodes it as JPEG. */
function encodeJpeg(bitmap: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // transparent PNGs would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

async function readTakenAt(file: File) {
  try {
    // Loaded on first upload only, to keep it out of the main bundle.
    const { default: exifr } = await import('exifr')
    const tags = await exifr.parse(file, ['DateTimeOriginal'])
    const date: unknown = tags?.DateTimeOriginal
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
  } catch {
    return null
  }
}
