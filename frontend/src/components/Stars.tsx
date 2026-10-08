export function Stars({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <span className="text-[13px] text-amber" aria-label={`별점 ${value}`}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
    </span>
  )
}
