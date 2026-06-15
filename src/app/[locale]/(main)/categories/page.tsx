import type { Metadata } from "next"
import { headers } from "next/headers"
import type { HttpTypes } from "@medusajs/types"

import { listRegions } from "@/lib/data/regions"
import { listCategories } from "@/lib/data/categories"
import { parsePurchaseMode } from "@/lib/helpers/parse-purchase-mode"
import { toHreflang } from "@/lib/helpers/hreflang"
import {
  AllCategoriesGrid,
  CategoriesHero,
  CategoryFilterChips,
  FeaturedCategoriesStrip,
} from "@/components/sections/CategoriesIndex"
import { CATEGORY_FILTER_ORDER, FEATURED_CATEGORY_HANDLES } from "@/data/categories-featured"
import {
  getCategoriesIndexCopy,
  type CategoryFilterId,
} from "@/lib/i18n/categories-index-copy"
import { StorefrontI18nLongContentProbe } from "@/components/atoms"

export const revalidate = 300

interface CategoriesPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ filter?: string; mode?: string; query?: string }>
}

interface DisplayCategory {
  id: string
  handle: string
  name: string
  rank: number
  metadata: Record<string, unknown>
  subcategoryCount: number
}

const FILTER_SET = new Set<CategoryFilterId>(["all", "popular", "new", "offers", "premium"])

function normalizeFilter(filterParam: string | undefined): CategoryFilterId {
  if (!filterParam) {
    return "all"
  }

  return FILTER_SET.has(filterParam as CategoryFilterId)
    ? (filterParam as CategoryFilterId)
    : "all"
}

function toDisplayCategories(categories: HttpTypes.StoreProductCategory[]): DisplayCategory[] {
  return categories
    .filter((category) => Boolean(category?.id && category?.handle && category?.name))
    .map((category) => {
      const rankValue =
        typeof category.rank === "number"
          ? category.rank
          : Number.parseInt(String(category.rank ?? "999"), 10)

      const safeRank = Number.isFinite(rankValue) ? rankValue : 999
      const childCount = Array.isArray(category.category_children)
        ? category.category_children.length
        : 0

      return {
        id: String(category.id),
        handle: String(category.handle),
        name: String(category.name),
        rank: safeRank,
        metadata:
          category.metadata && typeof category.metadata === "object"
            ? (category.metadata as Record<string, unknown>)
            : {},
        subcategoryCount: childCount,
      }
    })
    .sort((a, b) => a.rank - b.rank)
}

function metadataBoolean(value: unknown): boolean {
  if (value === true || value === 1) {
    return true
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "true" || normalized === "1" || normalized === "yes"
  }

  return false
}

function selectFeaturedCategories(categories: DisplayCategory[]): DisplayCategory[] {
  const curated = FEATURED_CATEGORY_HANDLES.map((handle) =>
    categories.find((category) => category.handle === handle)
  ).filter((category): category is DisplayCategory => Boolean(category))

  if (curated.length >= 3) {
    return curated.slice(0, 3)
  }

  const fallback = categories.filter(
    (category) => !curated.some((curatedCategory) => curatedCategory.id === category.id)
  )

  return [...curated, ...fallback].slice(0, 3)
}

function applyFilter(categories: DisplayCategory[], filter: CategoryFilterId): DisplayCategory[] {
  if (filter === "all") {
    return categories
  }

  if (filter === "popular") {
    const popular = categories.filter((category) => category.rank <= 3)
    return popular.length > 0 ? popular : categories.slice(0, Math.min(8, categories.length))
  }

  if (filter === "new") {
    const byMetadata = categories.filter((category) => metadataBoolean(category.metadata.is_new))
    if (byMetadata.length > 0) {
      return byMetadata
    }

    return [...categories].reverse().slice(0, Math.min(8, categories.length))
  }

  if (filter === "offers") {
    const withOffers = categories.filter((category) => metadataBoolean(category.metadata.has_offer))
    return withOffers.length > 0 ? withOffers : categories.slice(0, Math.min(8, categories.length))
  }

  const premium = categories.filter((category) => metadataBoolean(category.metadata.premium))
  if (premium.length > 0) {
    return premium
  }

  return categories.filter((_, index) => index % 2 === 0)
}

function normalizeQuery(queryParam: string | undefined): string | null {
  if (!queryParam) {
    return null
  }

  const normalized = queryParam.trim().slice(0, 120)
  return normalized.length > 0 ? normalized : null
}

function resolveCategoryPurchaseMode(metadata: Record<string, unknown>): "self" | "gift" | "both" {
  const gpMetadata = metadata.gp
  const gpMode =
    gpMetadata && typeof gpMetadata === "object"
      ? (gpMetadata as Record<string, unknown>).purchase_mode
      : undefined
  const rootMode = metadata.purchase_mode
  const rawMode =
    typeof gpMode === "string" ? gpMode : typeof rootMode === "string" ? rootMode : null

  if (!rawMode) {
    return "both"
  }

  const normalized = rawMode.trim().toLowerCase()
  if (normalized === "self" || normalized === "gift" || normalized === "both") {
    return normalized
  }

  return "both"
}

function applyDiscoveryFilters(
  categories: DisplayCategory[],
  mode: "self" | "gift",
  queryParam: string | undefined
) {
  const query = normalizeQuery(queryParam)?.toLowerCase()

  return categories.filter((category) => {
    const categoryMode = resolveCategoryPurchaseMode(category.metadata)
    if (mode === "gift" && categoryMode === "self") {
      return false
    }

    if (mode === "self" && categoryMode === "gift") {
      return false
    }

    if (!query) {
      return true
    }

    const name = category.name.toLowerCase()
    const handle = category.handle.toLowerCase()
    return name.includes(query) || handle.includes(query)
  })
}

async function buildAlternateLanguages(baseUrl: string, locale: string) {
  try {
    const regions = await listRegions()
    const locales = Array.from(
      new Set((regions || []).flatMap((region) => region.countries?.map((country) => country.iso_2) || []))
    ) as string[]

    return locales.reduce<Record<string, string>>((acc, code) => {
      acc[toHreflang(code)] = `${baseUrl}/${code}/categories`
      return acc
    }, {})
  } catch {
    return { [toHreflang(locale)]: `${baseUrl}/${locale}/categories` }
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const copy = getCategoriesIndexCopy(locale)

  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
  const languages = await buildAlternateLanguages(baseUrl, locale)
  const canonical = `${baseUrl}/${locale}/categories`

  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: {
      canonical,
      languages: {
        ...languages,
        "x-default": `${baseUrl}/categories`,
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: copy.metadataTitle,
      description: copy.metadataDescription,
      url: canonical,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Storefront",
      type: "website",
    },
  }
}

export default async function CategoriesPage({ params, searchParams }: CategoriesPageProps) {
  const { locale } = await params
  const { filter: filterParam, mode: modeParam, query: queryParam } = await searchParams
  const requestedMode = parsePurchaseMode(modeParam)
  const activeFilter = normalizeFilter(filterParam)
  const effectiveFilter = !filterParam && requestedMode === "gift" ? "offers" : activeFilter
  const copy = getCategoriesIndexCopy(locale)

  const { categories } = await listCategories({
    query: {
      include_ancestors_tree: true,
      include_descendants_tree: true,
      limit: 120,
    },
  })

  const mappedCategories = toDisplayCategories(categories)
  const featuredCategories = selectFeaturedCategories(mappedCategories)
  const filteredByPrimaryFilter = applyFilter(mappedCategories, effectiveFilter)
  const filteredCategories = applyDiscoveryFilters(filteredByPrimaryFilter, requestedMode, queryParam)
  const filterChips = CATEGORY_FILTER_ORDER.map((filterId) => ({
    id: filterId,
    label: copy.filters[filterId],
  }))

  return (
    <main id="main-content" tabIndex={-1} className="container" data-testid="categories-index-page">
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="category-listing"
      />

      <CategoriesHero
        breadcrumbsHome={copy.breadcrumbsHome}
        breadcrumbsCurrent={copy.breadcrumbsCurrent}
        breadcrumbsAriaLabel={copy.breadcrumbsAriaLabel}
        eyebrow={copy.heroEyebrow}
        title={copy.heroTitle}
        intro={copy.heroIntro}
      />

      <FeaturedCategoriesStrip
        eyebrow={copy.featuredEyebrow}
        title={copy.featuredTitle}
        countLabel={copy.featuredCountLabel}
        categories={featuredCategories}
      />

      <CategoryFilterChips
        chips={filterChips}
        activeFilter={effectiveFilter}
        ariaLabel={copy.filtersAriaLabel}
      />

      <AllCategoriesGrid
        title={copy.allCategoriesTitle}
        description={copy.allCategoriesDescription}
        imageAltPrefix={copy.categoryImageAlt}
        imageMissingLabel={copy.categoryImageMissing}
        countLabel={copy.gridCountLabel}
        categories={filteredCategories}
      />
    </main>
  )
}
