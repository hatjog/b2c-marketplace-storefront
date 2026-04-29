'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { HttpTypes } from '@medusajs/types';

import { PriceDisplay } from '@/components/molecules/PriceDisplay/PriceDisplay';
import { SELLER_SERVICE_LIST_PAGE_SIZE } from '@/lib/constants';

// D-13 (v1.4.0 carry-over): `currencyCode` removed — was dead prop because
// PriceDisplay is currently hardcoded PLN. When multi-currency rolls out at
// the locale boundary, reintroduce the prop and thread it into PriceDisplay.
export interface SellerServiceListProps {
  products: HttpTypes.StoreProduct[];
}

function getCheapestPrice(product: HttpTypes.StoreProduct): number | null {
  const prices = (product.variants ?? [])
    .map((v: any) => v.calculated_price?.calculated_amount)
    .filter((p: unknown): p is number => typeof p === 'number');
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export function SellerServiceList({ products }: SellerServiceListProps) {
  const [showAll, setShowAll] = useState(false);

  if (products.length === 0) {
    return null;
  }

  const hasMore = products.length > SELLER_SERVICE_LIST_PAGE_SIZE;
  const visible = showAll ? products : products.slice(0, SELLER_SERVICE_LIST_PAGE_SIZE);

  return (
    <section aria-labelledby="seller-services-heading" data-testid="seller-service-list">
      <h2 id="seller-services-heading" className="mb-4 text-xl font-bold">
        Zabiegi i usługi
      </h2>

      <ul className="divide-y divide-gray-100">
        {visible.map((product) => {
          const price = getCheapestPrice(product);

          return (
            <li
              key={product.id}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{product.title}</p>
                {price !== null && (
                  <PriceDisplay
                    amountInCents={price}
                    size="sm"
                    className="mt-0.5 text-gray-600"
                  />
                )}
              </div>
              <Link
                href={`/products/${product.handle}`}
                className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                Kup voucher
              </Link>
            </li>
          );
        })}
      </ul>

      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 text-sm font-medium underline hover:no-underline"
        >
          Pokaż więcej ({products.length - SELLER_SERVICE_LIST_PAGE_SIZE})
        </button>
      )}
    </section>
  );
}
