'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useSearchParams } from 'next/navigation';

import {
  ProductListingLoadingView,
  ProductListingNoResultsView,
  ProductListingProductsView
} from '@/components/molecules';
import {
  AlgoliaProductSidebar,
  ProductListingActiveFilters,
  ProductsPagination
} from '@/components/organisms';
import { ProductListingSkeleton } from '@/components/organisms/ProductListingSkeleton/ProductListingSkeleton';
import type { FacetModel } from '@/components/organisms/ProductSidebar/AlgoliaProductSidebar';
import { PRODUCT_LIMIT } from '@/const';
import { searchProducts } from '@/lib/data/products';
import { getFacedFilters } from '@/lib/helpers/get-faced-filters';

export const AlgoliaProductsListing = ({
  category_id,
  collection_id,
  seller_handle,
  locale = process.env.NEXT_PUBLIC_DEFAULT_REGION,
  countryCode,
  currency_code
}: {
  category_id?: string;
  collection_id?: string;
  locale?: string;
  countryCode: string;
  seller_handle?: string;
  currency_code: string;
}) => {
  const searchParams = useSearchParams();

  const facetFilters: string = getFacedFilters(searchParams);
  const query: string = searchParams.get('query') || '';
  const page: number = +(searchParams.get('page') || 1);

  const filters = `${
    seller_handle
      ? `NOT seller:null AND seller.handle:${seller_handle} AND `
      : 'NOT seller:null AND '
  }NOT seller.store_status:SUSPENDED AND supported_countries:${countryCode}${
    category_id
      ? ` AND categories.id:${category_id}${
          collection_id !== undefined ? ` AND collections.id:${collection_id}` : ''
        } ${facetFilters}`
      : ` ${facetFilters}`
  }`;

  return (
    <ProductsListing
      locale={locale}
      countryCode={countryCode}
      currency_code={currency_code}
      filters={filters}
      query={query}
      page={page}
    />
  );
};

const ProductsListing = ({
  locale,
  countryCode,
  currency_code,
  filters,
  query,
  page
}: {
  locale?: string;
  countryCode: string;
  currency_code: string;
  filters: string;
  query: string;
  page: number;
}) => {
  const [products, setProducts] = useState<(HttpTypes.StoreProduct & { seller?: any })[]>([]);
  const [facets, setFacets] = useState<Record<string, FacetModel[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [pages, setPages] = useState(1);

  const _searchParams = useSearchParams();

  useEffect(() => {
    async function fetchProducts() {
      if (!countryCode) return;

      try {
        setIsLoading(true);
        const result = await searchProducts({
          query: query || undefined,
          page: page - 1,
          hitsPerPage: PRODUCT_LIMIT,
          filters,
          currency_code,
          countryCode
        });

        setProducts(result.products);
        setFacets(result.facets);
        setCount(result.nbHits);
        setPages(result.nbPages);
      } catch {
        setProducts([]);
        setFacets({});
        setCount(0);
        setPages(0);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProducts();
  }, [locale, filters, query, page, currency_code]);

  if (isLoading && products.length === 0) return <ProductListingSkeleton />;

  return (
    <div className="min-h-[70vh]">
      <div className="flex w-full items-center justify-between">
        <div className="label-md my-4">{`${count} listings`}</div>
      </div>
      <div className="hidden md:block">
        <ProductListingActiveFilters />
      </div>
      <div className="gap-4 md:flex">
        <div className="hidden w-[280px] flex-shrink-0 md:block">
          <AlgoliaProductSidebar facets={facets} />
        </div>
        <div className="flex w-full flex-col">
          {isLoading && <ProductListingLoadingView />}

          {!isLoading && !products.length && <ProductListingNoResultsView />}

          {!isLoading && products.length > 0 && <ProductListingProductsView products={products} />}

          <div className="mt-auto">
            <ProductsPagination pages={pages} />
          </div>
        </div>
      </div>
    </div>
  );
};
