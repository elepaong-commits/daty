import { categoryOf, PHOTO_GRADIENTS } from '../lib/categories'
import type { PlaceCategory } from '../lib/types'
import { useImageFailed } from '../lib/useImageFailed'

/** A photo, or the category's gradient + icon while there is none (or its file is gone). */
export function PhotoTile({
  src,
  category,
  className = '',
  iconSize = 40,
}: {
  src?: string | null
  category: PlaceCategory
  className?: string
  iconSize?: number
}) {
  const { failed, onError } = useImageFailed(src)
  if (src && !failed) return <img src={src} alt="" loading="lazy" onError={onError} className={`object-cover ${className}`} />
  const [from, to] = PHOTO_GRADIENTS[category][0]!
  const { Icon } = categoryOf(category)
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ background: `linear-gradient(${from}, ${to})` }}>
      <Icon size={iconSize} strokeWidth={1.5} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.18)]" />
    </div>
  )
}
