"use client"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useMemo, useState } from "react"
import Image from "next/image"
import type { CategoryImage } from "@/lib/category-images"

interface GridCategory {
  id: string
  handle: string
  name: string
  image: CategoryImage
  subcategoryCount: number
}

interface AllCategoriesGridProps {
  title: string
  description: string
  imageAltPrefix: string
  imageMissingLabel: string
  countLabel: string
  categories: GridCategory[]
}

function CategoryTile({
  category,
  imageAltPrefix,
  imageMissingLabel,
  countLabel,
}: {
  category: GridCategory
  imageAltPrefix: string
  imageMissingLabel: string
  countLabel: string
}) {
  const [imageBroken, setImageBroken] = useState(false)
  const imageSrc = category.image.src

  // Alt must stay consistent with the displayed image: the alt carried by the
  // chosen gp.images element wins — including an intentionally EMPTY string
  // (decorative-image convention, AC1). Generic label applies only when the
  // reader carried no alt at all (`null`), not when it carried `''` (3-1-F5).
  const imageAlt = useMemo(
    () =>
      category.image.alt !== null
        ? category.image.alt
        : `${imageAltPrefix}: ${category.name}`,
    [category.image.alt, imageAltPrefix, category.name]
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
          />
        ))}
      </div>
    </section>
  )
}
