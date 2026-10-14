import { Star } from 'lucide-react'
import { useT } from '../lib/i18n'

export function Stars({ value }: { value: number }) {
  const t = useT()
  const full = Math.round(value)
  return (
    <span className="inline-flex gap-px text-amber" aria-label={t.common.stars(value)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={12} strokeWidth={1.75} fill={n <= full ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}
