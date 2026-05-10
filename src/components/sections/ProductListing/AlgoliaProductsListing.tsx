'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { DiscoveryEmptyState } from '@/components/cells/DiscoveryEmptyState/DiscoveryEmptyState';
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
  currency_code,
  fromContext
}: {
  category_id?: string;
  collection_id?: string;
  locale?: string;
  countryCode: string;
  seller_handle?: string;
  currency_code: string;
  /**
   * Story v160-4-6: optional salon-anchored context propagated to ProductCard.
   */
  fromContext?: { type: 'seller'; handle: string };
}) => {
  const searchParams = useSearchParams();

  const facetFilters: string = getFacedFilters(searchParams);
  const query: string = searchParams.get('query') || '';
  const page: number = +(searchParams.get('page') || 1);

  const filters = `${
    seller_handle
      ? `NOT seller:null AND seller.handle:${seller_handle} AND `
      : 'NOT seller:null AND '
  }seller.status:open AND supported_countries:${countryCode}${
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
      fromContext={fromContext}
    />
  );
};

const ProductsListing = ({
  locale,
  countryCode,
  currency_code,
  filters,
  query,
  page,
  fromContext
}: {
  locale?: string;
  countryCode: string;
  currency_code: string;
  filters: string;
  query: string;
  page: number;
  fromContext?: { type: 'seller'; handle: string };
}) => {
  const [products, setProducts] = useState<(HttpTypes.StoreProduct & { seller?: any })[]>([]);
  const [facets, setFacets] = useState<Record<string, FacetModel[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [pages, setPages] = useState(1);
  // v1.7.0 Story 2.2 re-review fix (LOW L3'): distinguish "no-results" (zero
  // hits) from "load-error" (provider/network failure) so the UI does not
  // mask a failure as an empty state — UX-DR19 explicitly forbids this mask.
  const [loadError, setLoadError] = useState(false);

  const _searchParams = useSearchParams();
  const tCategory = useTranslations('category');

  useEffect(() => {
    async function fetchProducts() {
      if (!countryCode) return;

      try {
        setIsLoading(true);
        setLoadError(false);
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
      } catch (err) {
        // v1.7.0 Story 2.2 re-review fix (LOW L3'): log the underlying error to
        // the browser console so ops have a signal — previously the catch was
        // parameterless and the failure was silent (mirror I3 fix in ProductListing).
        console.error(
          '[AlgoliaProductsListing] search failed:',
          err instanceof Error ? err.message : String(err)
        );
        setProducts([]);
        setFacets({});
        setCount(0);
        setPages(0);
        setLoadError(true);
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
        {/* v1.7.0 Story 2.2 re-review fix (HIGH H1' / LOW L1'): replaced
            hardcoded EN `${count} listings` with the ICU plural i18n key
            `category.results_count` that ships PL/EN/UA/DE plurals. */}
        <div className="label-md my-4">{tCategory('results_count', { count })}</div>
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

          {/* v1.7.0 Story 2.2 re-review fix (LOW L3'): surface load-error as a
              distinct state instead of masking it as no-results (UX-DR19). */}
          {!isLoading && loadError && (
            <div className="py-6" data-testid="algolia-product-listing-error">
              <DiscoveryEmptyState variant="load-error" />
            </div>
          )}

          {!isLoading && !loadError && !products.length && <ProductListingNoResultsView />}

          {!isLoading && !loadError && products.length > 0 && (
            <ProductListingProductsView products={products} fromContext={fromContext} />
          )}

          <div className="mt-auto">
            <ProductsPagination pages={pages} />
          </div>
        </div>
      </div>
    </div>
  );
};
