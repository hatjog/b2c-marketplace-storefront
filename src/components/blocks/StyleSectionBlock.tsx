import { ShopByStyleSection } from "@/components/sections"

export type StyleSectionSectionBlock = {
  heading?: string | null
}

export function StyleSectionBlock({
  section,
}: {
  section: StyleSectionSectionBlock
}) {
  return <ShopByStyleSection key={section.heading ?? "style-section"} />
}
