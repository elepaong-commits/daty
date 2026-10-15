import { SPRITE_PALETTE, SPRITES, type SpriteName } from '../lib/sprites'

interface Layer {
  color: string
  path: string
}

const layersCache = new Map<SpriteName, { width: number; height: number; layers: Layer[] }>()

/** One SVG path per colour, so a sprite is a handful of elements however many pixels it has. */
function layersOf(name: SpriteName) {
  const cached = layersCache.get(name)
  if (cached) return cached
  const rows = SPRITES[name]
  const paths = new Map<string, string>()
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.') paths.set(ch, `${paths.get(ch) ?? ''}M${x} ${y}h1v1h-1z`)
    }),
  )
  const result = {
    width: Math.max(...rows.map((r) => r.length)),
    height: rows.length,
    layers: [...paths].map(([color, path]) => ({ color, path })),
  }
  layersCache.set(name, result)
  return result
}

/**
 * A pixel sprite drawn at a whole-number `scale` so every pixel stays square. `colors` overrides
 * palette letters, e.g. `{ x: 'var(--color-coral)' }` for a pin.
 */
export function PixelSprite({
  name,
  scale = 2,
  colors,
  className,
}: {
  name: SpriteName
  scale?: number
  colors?: Record<string, string>
  className?: string
}) {
  const { width, height, layers } = layersOf(name)
  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ''}`}
    >
      {layers.map(({ color, path }) => (
        <path key={color} d={path} fill={colors?.[color] ?? SPRITE_PALETTE[color]} />
      ))}
    </svg>
  )
}
