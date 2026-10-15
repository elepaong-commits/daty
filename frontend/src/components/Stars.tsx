import { Star } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useIsRetro } from '../lib/theme'
import { PixelSprite } from './PixelSprite'

export function Stars({ value }: { value: number }) {
  const t = useT()
  const retro = useIsRetro()
  const full = Math.round(value)
  return (
    <span className="inline-flex gap-px text-amber" role="img" aria-label={t.common.stars(value)}>
      {[1, 2, 3, 4, 5].map((n) =>
        retro ? (
          <PixelSprite key={n} name={n <= full ? 'star' : 'starOff'} scale={1} />
        ) : (
          <Star key={n} size={12} strokeWidth={1.75} fill={n <= full ? 'currentColor' : 'none'} />
        ),
      )}
    </span>
  )
}
