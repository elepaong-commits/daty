import { useT } from '../lib/i18n'

export function Stars({ value }: { value: number }) {
  const t = useT()
  const full = Math.round(value)
  return (
    <span className="text-[13px] text-amber" aria-label={t.common.stars(value)}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
    </span>
  )
}
