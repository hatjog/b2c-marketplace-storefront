import deMessages from "../../../messages/de.json"
import enMessages from "../../../messages/en.json"
import plMessages from "../../../messages/pl.json"
import uaMessages from "../../../messages/ua.json"

export type CategoriesIndexLocale = "pl" | "en" | "ua" | "de"
export type CategoryFilterId = "all" | "popular" | "new" | "offers" | "premium"

export interface CategoriesIndexCopy {
  metadataTitle: string
  metadataDescription: string
  breadcrumbsHome: string
  breadcrumbsCurrent: string
  breadcrumbsAriaLabel: string
  heroEyebrow: string
  heroTitle: string
  heroIntro: string
  featuredEyebrow: string
  featuredTitle: string
  featuredCountLabel: string
  filters: Record<CategoryFilterId, string>
  filtersAriaLabel: string
  allCategoriesTitle: string
  allCategoriesDescription: string
  categoryImageAlt: string
  categoryImageMissing: string
  gridCountLabel: string
}

interface CategoriesIndexMessages {
  categories_index: {
    metadata_title: string
    metadata_description: string
    breadcrumbs: {
      home: string
      current: string
    }
    breadcrumbs_aria_label: string
    hero: {
      eyebrow: string
      title: string
      intro: string
    }
    featured: {
      eyebrow: string
      title: string
      count_label: string
    }
    filters: Record<CategoryFilterId, string>
    filters_aria_label: string
    grid: {
      title: string
      description: string
      image_alt: string
      missing_image: string
      count_label: string
    }
  }
}

const messageCatalog: Record<CategoriesIndexLocale, CategoriesIndexMessages> = {
  pl: plMessages as CategoriesIndexMessages,
  en: enMessages as CategoriesIndexMessages,
  ua: uaMessages as CategoriesIndexMessages,
  de: deMessages as CategoriesIndexMessages,
}

function toCopy(messages: CategoriesIndexMessages): CategoriesIndexCopy {
  const copy = messages.categories_index

  return {
    metadataTitle: copy.metadata_title,
    metadataDescription: copy.metadata_description,
    breadcrumbsHome: copy.breadcrumbs.home,
    breadcrumbsCurrent: copy.breadcrumbs.current,
    breadcrumbsAriaLabel: copy.breadcrumbs_aria_label,
    heroEyebrow: copy.hero.eyebrow,
    heroTitle: copy.hero.title,
    heroIntro: copy.hero.intro,
    featuredEyebrow: copy.featured.eyebrow,
    featuredTitle: copy.featured.title,
    featuredCountLabel: copy.featured.count_label,
    filters: copy.filters,
    filtersAriaLabel: copy.filters_aria_label,
    allCategoriesTitle: copy.grid.title,
    allCategoriesDescription: copy.grid.description,
    categoryImageAlt: copy.grid.image_alt,
    categoryImageMissing: copy.grid.missing_image,
    gridCountLabel: copy.grid.count_label,
  }
}

export const getCategoriesIndexCopy = (locale: string): CategoriesIndexCopy => {
  if (locale === "pl" || locale === "en" || locale === "ua" || locale === "de") {
    return toCopy(messageCatalog[locale])
  }

  return toCopy(messageCatalog.en)
}
