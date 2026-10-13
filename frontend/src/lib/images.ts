// Phone originals run 5–10MB; albums only need screen-sized images, so photos are shrunk before upload.
const MAX_EDGE = 2048
const JPEG_QUALITY = 0.85

export interface PreparedImage {
  blob: Blob
  contentType: 'image/jpeg'
  takenAt: string | null // EXIF capture time, ISO
}

/** Shrinks a picked photo to a ≤2048px JPEG and reads when it was taken. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  // Read EXIF from the original: re-encoding through a canvas drops it.
  const [bitmap, takenAt] = await Promise.all([
    // Rotated per EXIF orientation by default.
    createImageBitmap(file).catch(() => {
      throw new Error(`${file.name}: 열 수 없는 사진 형식이에요`)
    }),
    readTakenAt(file),
  ])
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // transparent PNGs would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error(`${file.name}: 사진을 변환하지 못했어요`)
  return { blob, contentType: 'image/jpeg', takenAt }
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
