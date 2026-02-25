import { Hero } from "@/components/sections"
import Link from "next/link"

type HeroButton = {
  label?: string | null
  url?: string | null
  variant?: string | null
}

type HeroImage =
  | string
  | {
      url?: string | null
    }
  | null
  | undefined

export type HeroSectionBlock = {
  heading?: string | null
  paragraph?: string | null
  image?: HeroImage
  buttons?: HeroButton[] | null
}

function getImageUrl(image: HeroImage): string | null {
  if (!image) {
    return null
  }

  if (typeof image === "string") {
    return image
  }

  return image.url ?? null
}

function mapButtons(buttons: HeroButton[] | null | undefined) {
  return (buttons ?? [])
    .map((button) => {
      if (!button?.label || !button.url) {
        return null
      }

      return {
        label: button.label,
        path: button.url,
      }
    })
    .filter((button): button is { label: string; path: string } => Boolean(button))
}

export function HeroBlock({ section }: { section: HeroSectionBlock }) {
  const heading = section.heading ?? ""
  const paragraph = section.paragraph ?? ""
  const imageUrl = getImageUrl(section.image)
  const buttons = mapButtons(section.buttons)

  if (imageUrl) {
    return (
      <Hero
        image={imageUrl}
        heading={heading}
        paragraph={paragraph}
        buttons={buttons}
      />
    )
  }

  if (section.image == null) {
    console.error("[homepage] hero image is missing or invalid", section)
  }

  return (
    <section className="w-full flex container mt-5 flex-col lg:flex-row text-primary">
      <div className="w-full">
        <div className="border rounded-sm w-full px-6 py-8">
          <h2 className="font-bold mb-6 uppercase display-md max-w-[652px] text-4xl md:text-5xl leading-tight">
            {heading}
          </h2>
          <p className="text-lg mb-8">{paragraph}</p>
          {buttons.length > 0 && (
            <div className="flex font-bold uppercase gap-4">
              {buttons.map(({ label, path }) => (
                <Link
                  key={path}
                  href={path}
                  className="group flex border rounded-sm bg-content hover:bg-action hover:text-tertiary transition-all duration-300 p-4"
                  aria-label={label}
                  title={label}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}