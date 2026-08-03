import type { CategoryFilterId } from "@/lib/i18n/categories-index-copy"

export const FEATURED_CATEGORY_HANDLES = [
  "pielegnacja-twarzy",
  "rytualy-spa",
  "masaz",
  "facial-care",
  "spa-rituals",
  "massage",
] as const

export const CATEGORY_FILTER_ORDER: CategoryFilterId[] = [
  "all",
  "popular",
  "new",
  "offers",
  "premium",
]
