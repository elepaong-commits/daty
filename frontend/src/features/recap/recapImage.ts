import type { Messages } from '../../lib/messages'
import type { Recap } from '../../lib/types'

// The year's recap as one picture to share (1080×1350, the portrait size social apps show whole).
// Drawn straight onto a canvas from the numbers, in the app's colours and fonts.

const W = 1080
const H = 1350
const PAD = 80

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

/** Cuts text to fit `max` px, ending in "…". */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
  return `${cut}…`
}

export async function drawRecapImage(recap: Recap, t: Messages, couple: string, retro: boolean): Promise<Blob> {
  const display = retro ? 'Galmuri14' : 'Jua'
  const body = retro ? 'Galmuri11' : '"IBM Plex Sans KR", "IBM Plex Sans JP"'
  // Every face drawn below, so none falls back to the default font.
  const faces = [`64px ${display}`, `700 32px ${body}`, `500 28px ${body}`]
  await Promise.all(faces.map((face) => document.fonts.load(face, '0123456789가あ'))).catch(() => {})
  const radius = retro ? 0 : 28
  const colors = {
    ground: token('color-cream'),
    card: '#ffffff',
    ink: token('color-ink'),
    muted: token('color-muted'),
    brand: token('color-brand-strong'),
    bar: token('color-brand'),
    soft: token('color-brand-soft'),
    coral: token('color-coral-strong'),
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = colors.ground
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  // Heading
  ctx.fillStyle = colors.brand
  ctx.font = `700 30px ${body}`
  ctx.fillText(fit(ctx, couple, W - PAD * 2), PAD, 130)
  ctx.fillStyle = colors.ink
  ctx.font = `76px ${display}`
  ctx.fillText(t.recap.title(recap.year), PAD, 220)

  // Six numbers, three to a row
  const { totals } = recap
  const tiles: [string, number][] = [
    [t.recap.totals.days, totals.days],
    [t.recap.totals.visits, totals.visits],
    [t.recap.totals.places, totals.places],
    [t.recap.totals.newPlaces, totals.newPlaces],
    [t.recap.totals.photos, totals.photos],
    [t.recap.totals.videos, totals.videos],
  ]
  const gap = 20
  const tileW = (W - PAD * 2 - gap * 2) / 3
  const tileH = 150
  tiles.forEach(([label, value], i) => {
    const x = PAD + (i % 3) * (tileW + gap)
    const y = 280 + Math.floor(i / 3) * (tileH + gap)
    ctx.fillStyle = colors.card
    roundRect(ctx, x, y, tileW, tileH, radius)
    ctx.fillStyle = colors.muted
    ctx.font = `500 24px ${body}`
    ctx.fillText(fit(ctx, label, tileW - 48), x + 24, y + 48)
    ctx.fillStyle = colors.ink
    ctx.font = `64px ${display}`
    ctx.fillText(String(value), x + 24, y + 122)
  })

  // Month bars
  const chartTop = 640
  ctx.fillStyle = colors.card
  roundRect(ctx, PAD, chartTop, W - PAD * 2, 300, radius)
  ctx.fillStyle = colors.ink
  ctx.font = `34px ${display}`
  ctx.fillText(t.recap.months, PAD + 32, chartTop + 60)
  const most = Math.max(...recap.months, 1)
  const slot = (W - PAD * 2 - 64) / 12
  recap.months.forEach((count, m) => {
    const h = Math.round((count / most) * 150)
    const x = PAD + 32 + m * slot + slot * 0.2
    ctx.fillStyle = count > 0 ? colors.bar : colors.soft
    roundRect(ctx, x, chartTop + 240 - Math.max(h, 6), slot * 0.6, Math.max(h, 6), retro ? 0 : 8)
    ctx.fillStyle = colors.muted
    ctx.font = `500 20px ${body}`
    ctx.textAlign = 'center'
    ctx.fillText(String(m + 1), x + slot * 0.3, chartTop + 276)
    ctx.textAlign = 'left'
  })

  // Places they went back to most
  const listTop = 980
  ctx.fillStyle = colors.card
  roundRect(ctx, PAD, listTop, W - PAD * 2, 250, radius)
  ctx.fillStyle = colors.ink
  ctx.font = `34px ${display}`
  ctx.fillText(t.recap.mostVisited, PAD + 32, listTop + 60)
  recap.mostVisited.slice(0, 3).forEach((place, i) => {
    const y = listTop + 120 + i * 50
    ctx.fillStyle = colors.coral
    ctx.font = `700 28px ${body}`
    ctx.fillText(`${i + 1}`, PAD + 32, y)
    ctx.fillStyle = colors.ink
    ctx.font = `500 28px ${body}`
    ctx.fillText(fit(ctx, place.name, W - PAD * 2 - 260), PAD + 80, y)
    ctx.fillStyle = colors.muted
    ctx.textAlign = 'right'
    ctx.fillText(t.recap.times(place.visits), W - PAD - 32, y)
    ctx.textAlign = 'left'
  })

  ctx.fillStyle = colors.brand
  ctx.font = `40px ${display}`
  ctx.textAlign = 'right'
  ctx.fillText('daty', W - PAD, H - 56)

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/png'))
}
