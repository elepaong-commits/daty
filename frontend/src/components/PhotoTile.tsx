import { categoryOf, PHOTO_GRADIENTS } from '../lib/categories'
import type { PlaceCategory } from '../lib/types'
import { useImageFailed } from '../lib/useImageFailed'

/** A photo, or the category's gradient + emoji while there is none (or its file is gone). */
export function PhotoTile({
  src,
  category,
  className = '',
  emojiSize = 40,
}: {
  src?: string | null
  category: PlaceCategory
  className?: string
  emojiSize?: number
}) {
  const { failed, onError } = useImageFailed(src)
  if (src && !failed) return <img src={src} alt="" loading="lazy" onError={onError} className={`object-cover ${className}`} />
  const [from, to] = PHOTO_GRADIENTS[category][0]!
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ background: `linear-gradient(${from}, ${to})` }}>
      <span className="leading-none [text-shadow:0_4px_6px_rgba(0,0,0,0.18)]" style={{ fontSize: emojiSize }}>
        {categoryOf(category).emoji}
      </span>
    </div>
  )
}
