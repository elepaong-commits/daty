import { useT } from '../lib/i18n'
import { PixelSprite } from './PixelSprite'

export function Stars({ value }: { value: number }) {
  const t = useT()
  const full = Math.round(value)
  return (
    <span className="inline-flex gap-px" role="img" aria-label={t.common.stars(value)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <PixelSprite key={n} name={n <= full ? 'star' : 'starOff'} scale={1} />
      ))}
    </span>
  )
}
