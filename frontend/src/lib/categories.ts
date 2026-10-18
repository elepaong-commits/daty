import { BedDouble, Bike, CakeSlice, Coffee, type LucideIcon, Mountain, Palette, Utensils } from 'lucide-react'
import type { PlaceCategory, TipType } from './types'

// Order matches the filter chips on the map screen. Labels live in `t.categories`.
export const CATEGORIES: { value: PlaceCategory; Icon: LucideIcon }[] = [
  { value: 'FOOD', Icon: Utensils },
  { value: 'CAFE', Icon: Coffee },
  { value: 'DESSERT', Icon: CakeSlice },
  { value: 'EXHIBIT', Icon: Palette },
  { value: 'TOUR', Icon: Mountain },
  { value: 'ACTIVITY', Icon: Bike },
  { value: 'HOTEL', Icon: BedDouble },
]

// The schedule form lists tourist spots first.
export const FORM_CATEGORY_ORDER: PlaceCategory[] = ['TOUR', 'FOOD', 'CAFE', 'DESSERT', 'EXHIBIT', 'ACTIVITY', 'HOTEL']

const byValue = Object.fromEntries(CATEGORIES.map((c) => [c.value, c])) as Record<
  PlaceCategory,
  (typeof CATEGORIES)[number]
>

export const categoryOf = (value: PlaceCategory) => byValue[value]

// Labels live in `t.tips`.
export const TIP_CLASSES: Record<TipType, string> = {
  EAT: 'bg-coral-soft text-coral-strong',
  SEE: 'bg-amber-soft text-amber-strong',
  DO: 'bg-brand-soft text-brand-strong',
}

// Placeholder photo stacks until real photos are uploaded (gradients from the design).
export const PHOTO_GRADIENTS: Record<PlaceCategory, [string, string][]> = {
  CAFE: [['#f9d9a8', '#e8a87c'], ['#cdedea', '#00a896'], ['#ffe1d6', '#ff8c7a']],
  TOUR: [['#2d3a5a', '#f4a261'], ['#1e3a5f', '#6c8ebf'], ['#f6bd60', '#f28482']],
  EXHIBIT: [['#b8c0ff', '#e7c6ff'], ['#a0e7e5', '#b4f8c8'], ['#ffaebc', '#fbe7c6']],
  FOOD: [['#fff1c1', '#ffb703'], ['#f4e1d2', '#c08552'], ['#e6f7f5', '#7fd1c7']],
  ACTIVITY: [['#c9ece7', '#4fc3b4'], ['#ffe5b4', '#ffb703'], ['#b3e5fc', '#4fc3f7']],
  DESSERT: [['#ffe1ec', '#ff8fab'], ['#fff1c1', '#f9c784'], ['#e7c6ff', '#ffaebc']],
  HOTEL: [['#dbe7ff', '#7b9acc'], ['#f4e1d2', '#b08968'], ['#cdedea', '#4fc3b4']],
}
