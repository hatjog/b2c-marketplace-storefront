"use client"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import Image from "next/image"
import { useState } from "react"

interface FeaturedCategory {
  id: string
  handle: string
  name: string
  subcategoryCount: number
}

interface FeaturedCategoriesStripProps {
  eyebrow: string
  title: string
  countLabel: string
  categories: FeaturedCategory[]
}

function FeaturedCategoryTile({
  category,
  countLabel,
}: {
  category: FeaturedCategory
  countLabel: string
}) {
  const [imageBroken, setImageBroken] = useState(false)
  const showCount = category.subcategoryCount > 0

  return (
    <LocalizedClientLink
      href={`/categories/${category.handle}`}
      className="group rounded-md border border-primary/10 bg-component p-3 transition hover:border-secondary"
    >
      <div className="relative h-40 overflow-hidden rounded-sm bg-secondary/25">
        {imageBroken ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-secondary">
            {category.name}
          </div>
        ) : (
          <Image
            src={`/images/categories/${category.handle}.png`}
            alt={category.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(min-width: 1280px) 30vw, (min-width: 768px) 48vw, 100vw"
            onError={() => setImageBroken(true)}
          />
        )}
      </div>
      <div className="mt-3">
        <h3 className="heading-sm">{category.name}</h3>
        {showCount && (
          <p className="text-sm text-secondary">
            {category.subcategoryCount} {countLabel}
          </p>
        )}
      </div>
    </LocalizedClientLink>
  )
}

export function FeaturedCategoriesStrip({
  eyebrow,
  title,
  countLabel,
  categories,
}: FeaturedCategoriesStripProps) {
  return (
    <section className="mt-8" data-testid="featured-categories-strip">
      <div className="mb-4" data-testid="featured-categories-header">
        <p className="label-sm uppercase tracking-[0.08em] text-secondary">{eyebrow}</p>
        <h2 className="heading-lg mt-1">{title}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <FeaturedCategoryTile
            key={category.id}
            category={category}
            countLabel={countLabel}
          />
        ))}
      </div>
    </section>
  )
}
