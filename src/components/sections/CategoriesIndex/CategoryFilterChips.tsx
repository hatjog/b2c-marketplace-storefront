"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { CategoryFilterId } from "@/lib/i18n/categories-index-copy"

interface CategoryFilterChip {
  id: CategoryFilterId
  label: string
}

interface CategoryFilterChipsProps {
  chips: CategoryFilterChip[]
  activeFilter: CategoryFilterId
  ariaLabel: string
}

export function CategoryFilterChips({ chips, activeFilter, ariaLabel }: CategoryFilterChipsProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const onFilterClick = (filterId: CategoryFilterId) => {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (filterId === "all") {
      nextParams.delete("filter")
    } else {
      nextParams.set("filter", filterId)
    }

    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div
      className="mt-8 flex flex-wrap gap-2"
      role="toolbar"
      aria-label={ariaLabel}
      data-testid="categories-filter-chips"
    >
      {chips.map((chip) => {
        const isActive = chip.id === activeFilter

        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onFilterClick(chip.id)}
            className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
              isActive
                ? "border-secondary bg-action text-action-on-primary"
                : "border-primary bg-component text-primary hover:bg-component-hover"
            }`}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
