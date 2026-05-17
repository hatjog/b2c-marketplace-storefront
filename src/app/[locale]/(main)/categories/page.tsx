import type { Metadata } from "next"
import { headers } from "next/headers"
import { HttpTypes } from "@medusajs/types"

import { listRegions } from "@/lib/data/regions"
import { listCategories } from "@/lib/data/categories"
import { toHreflang } from "@/lib/helpers/hreflang"
import {
  AllCategoriesGrid,
  CategoriesHero,
  CategoryFilterChips,
  FeaturedCategoriesStrip,
} from "@/components/sections/CategoriesIndex"
import { CATEGORY_FILTER_ORDER, FEATURED_CATEGORY_HANDLES } from "@/data/categories-featured"
import {
  CategoryFilterId,
  getCategoriesIndexCopy,
} from "@/lib/i18n/categories-index-copy"
import { StorefrontI18nLongContentProbe } from "@/components/atoms"

export const revalidate = 300

interface CategoriesPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ filter?: string }>
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
  const { filter: filterParam } = await searchParams
  const activeFilter = normalizeFilter(filterParam)
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
  const filteredCategories = applyFilter(mappedCategories, activeFilter)
  const filterChips = CATEGORY_FILTER_ORDER.map((filterId) => ({
    id: filterId,
    label: copy.filters[filterId],
  }))

  return (
    <main className="container" data-testid="categories-index-page">
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
        activeFilter={activeFilter}
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
