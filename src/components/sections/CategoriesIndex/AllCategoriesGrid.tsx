"use client"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useMemo, useState } from "react"
import Image from "next/image"
import { categoryImageSrc } from "@/lib/category-images"
import { resolveMarketAssetUrl } from "@/lib/helpers/asset-reference"

interface GridCategory {
  id: string
  handle: string
  name: string
  photoUrl: string | null
  subcategoryCount: number
}

interface AllCategoriesGridProps {
  title: string
  description: string
  imageAltPrefix: string
  imageMissingLabel: string
  countLabel: string
  marketId: string
  categories: GridCategory[]
}

function CategoryTile({
  category,
  imageAltPrefix,
  imageMissingLabel,
  countLabel,
  marketId,
}: {
  category: GridCategory
  imageAltPrefix: string
  imageMissingLabel: string
  countLabel: string
  marketId: string
}) {
  const [imageBroken, setImageBroken] = useState(false)
  const imageSrc = categoryImageSrc(
    category.handle,
    resolveMarketAssetUrl(category.photoUrl, marketId)
  )

  const imageAlt = useMemo(
    () => `${imageAltPrefix}: ${category.name}`,
    [imageAltPrefix, category.name]
  )

  return (
    <LocalizedClientLink
      href={`/categories/${category.handle}`}
      className="group rounded-md border border-primary/10 bg-component p-3 transition hover:border-secondary"
      data-testid="category-index-tile"
    >
      <div className="relative h-44 overflow-hidden rounded-sm bg-secondary/25">
        {imageBroken ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-secondary">
            {imageMissingLabel}
          </div>
        ) : (
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(min-width: 1280px) 24vw, (min-width: 768px) 33vw, 100vw"
            onError={() => setImageBroken(true)}
          />
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <h3 className="heading-sm">{category.name}</h3>
        {category.subcategoryCount > 0 && (
          <span className="text-xs text-secondary">
            {category.subcategoryCount} {countLabel}
          </span>
        )}
      </div>
    </LocalizedClientLink>
  )
}

export function AllCategoriesGrid({
  title,
  description,
  imageAltPrefix,
  imageMissingLabel,
  countLabel,
  marketId,
  categories,
}: AllCategoriesGridProps) {
  return (
    <section className="mt-8" data-testid="all-categories-grid">
      <div className="mb-4" data-testid="all-categories-header">
        <h2 className="heading-lg">{title}</h2>
        <p className="text-md mt-2 text-secondary">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {categories.map((category) => (
          <CategoryTile
            key={category.id}
            category={category}
            imageAltPrefix={imageAltPrefix}
            imageMissingLabel={imageMissingLabel}
            countLabel={countLabel}
            marketId={marketId}
          />
        ))}
      </div>
    </section>
  )
}
