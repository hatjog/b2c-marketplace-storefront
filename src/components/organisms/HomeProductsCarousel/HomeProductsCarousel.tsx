import { Carousel } from "@/components/cells"
import { ProductCard } from "../ProductCard/ProductCard"
import { listProducts } from "@/lib/data/products"
import { Product } from "@/types/product"
import { HttpTypes } from "@medusajs/types"

export const HomeProductsCarousel = async ({
  locale,
  sellerProducts,
  home,
}: {
  locale: string
  sellerProducts: (Product | HttpTypes.StoreProduct)[]
  home: boolean
}) => {
  const products = sellerProducts.length
    ? sellerProducts
    : (
        await listProducts({
          countryCode: locale,
          queryParams: {
            limit: home ? 4 : undefined,
            order: "created_at",
            handle: home
              ? undefined
              : sellerProducts.map((product) => product.handle),
          },
          forceCache: !home,
        })
      ).response.products

  if (!products.length && !sellerProducts.length) return null

  return (
    <div className="flex justify-center w-full">
      <Carousel
        align="start"
        items={products.map(
          (product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          )
        )}
      />
    </div>
  )
}
