import { Carousel } from "@/components/cells"
import { CategoryCard } from "@/components/organisms"

type HomeCategory = { name: string; handle: string; id?: number }

export const categories: { id: number; name: string; handle: string }[] = [
  {
    id: 1,
    name: "Sneakers",
    handle: "sneakers",
  },
  {
    id: 2,
    name: "Sandals",
    handle: "sandals",
  },
  {
    id: 3,
    name: "Boots",
    handle: "boots",
  },
  {
    id: 4,
    name: "Sport",
    handle: "sport",
  },
  {
    id: 5,
    name: "Accessories",
    handle: "accessories",
  },
]

export const HomeCategories = async ({
  heading,
  categories: sectionCategories,
}: {
  heading: string
  categories?: HomeCategory[]
}) => {
  const categoriesToRender = sectionCategories?.length
    ? sectionCategories
    : categories

  return (
    <section className="bg-primary py-8 w-full">
      <div className="mb-6">
        <h2 className="heading-lg text-primary uppercase">{heading}</h2>
      </div>
      <Carousel
        items={categoriesToRender.map((category, index) => (
          <CategoryCard
            key={`${category.id ?? category.handle}-${index}`}
            category={category}
          />
        ))}
      />
    </section>
  )
}
