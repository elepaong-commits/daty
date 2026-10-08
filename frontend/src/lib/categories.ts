import type { PlaceCategory, TipType } from './types'

// Order matches the filter chips on the map screen.
export const CATEGORIES: { value: PlaceCategory; emoji: string; label: string }[] = [
  { value: 'FOOD', emoji: '🍽️', label: '식당' },
  { value: 'CAFE', emoji: '☕', label: '카페' },
  { value: 'EXHIBIT', emoji: '🎨', label: '전시회' },
  { value: 'TOUR', emoji: '🏞️', label: '관광지' },
  { value: 'BAR', emoji: '🍷', label: '술집' },
  { value: 'ACTIVITY', emoji: '🚲', label: '액티비티' },
]

// The schedule form lists tourist spots first.
export const FORM_CATEGORY_ORDER: PlaceCategory[] = ['TOUR', 'FOOD', 'CAFE', 'EXHIBIT', 'BAR', 'ACTIVITY']

const byValue = Object.fromEntries(CATEGORIES.map((c) => [c.value, c])) as Record<
  PlaceCategory,
  (typeof CATEGORIES)[number]
>

export const categoryOf = (value: PlaceCategory) => byValue[value]

export const TIPS: Record<TipType, { label: string; className: string }> = {
  EAT: { label: '🔥 이건 꼭 먹어야 해!', className: 'bg-coral-soft text-coral-strong' },
  SEE: { label: '👀 꼭 봐야 돼', className: 'bg-amber-soft text-amber-strong' },
  DO: { label: '✨ 꼭 해 봐', className: 'bg-brand-soft text-brand-strong' },
}

// Placeholder photo stacks until real photos are uploaded (gradients from the design).
export const PHOTO_GRADIENTS: Record<PlaceCategory, [string, string][]> = {
  CAFE: [['#f9d9a8', '#e8a87c'], ['#cdedea', '#00a896'], ['#ffe1d6', '#ff8c7a']],
  TOUR: [['#2d3a5a', '#f4a261'], ['#1e3a5f', '#6c8ebf'], ['#f6bd60', '#f28482']],
  EXHIBIT: [['#b8c0ff', '#e7c6ff'], ['#a0e7e5', '#b4f8c8'], ['#ffaebc', '#fbe7c6']],
  FOOD: [['#fff1c1', '#ffb703'], ['#f4e1d2', '#c08552'], ['#e6f7f5', '#7fd1c7']],
  BAR: [['#e9d8c4', '#b5835a'], ['#fce3c4', '#e76f51'], ['#ddebcf', '#8ab17d']],
  ACTIVITY: [['#c9ece7', '#4fc3b4'], ['#ffe5b4', '#ffb703'], ['#b3e5fc', '#4fc3f7']],
}
