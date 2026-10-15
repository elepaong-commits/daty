import { categoryOf } from '../lib/categories'
import { CATEGORY_SPRITES } from '../lib/sprites'
import { useIsRetro } from '../lib/theme'
import type { PlaceCategory } from '../lib/types'
import { PixelSprite } from './PixelSprite'

/** The category's line icon, or its pixel sprite in the pixel design. */
export function CategoryIcon({ category, size = 14, spriteScale = 2 }: { category: PlaceCategory; size?: number; spriteScale?: number }) {
  const retro = useIsRetro()
  if (retro) return <PixelSprite name={CATEGORY_SPRITES[category]} scale={spriteScale} />
  const { Icon } = categoryOf(category)
  return <Icon size={size} strokeWidth={1.75} />
}
