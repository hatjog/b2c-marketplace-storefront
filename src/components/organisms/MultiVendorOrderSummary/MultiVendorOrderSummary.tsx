import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { groupLineItemsBySeller } from '@/lib/helpers/cart-vendor-context';

interface MultiVendorOrderSummaryProps {
  cart: HttpTypes.StoreCart | null;
}

/**
 * Story v160-cleanup-12e — checkout order_set splits projection.
 *
 * Server Component rendered in the checkout sidebar when the multi-vendor
 * flag is ON and the cart has items from ≥2 distinct sellers. Shows a
 * per-vendor subtotal breakdown for the order split.
 *
 * Gate: caller (checkout/page.tsx) wraps this in `{isMultiVendorEnabled() && ...}`.
 * Internal guard: returns null when groups.length < 2 (single-vendor cart or
 * no seller metadata on any item) to avoid empty UI.
 *
 * data-testid="order-set-splits" — required by Story 8.8 AC6 Step 4 E2E assertion.
 */
export async function MultiVendorOrderSummary({ cart }: MultiVendorOrderSummaryProps) {
  if (!cart) return null;

  const items = cart.items ?? [];
  const groups = groupLineItemsBySeller(items);

  // Only render when cart spans ≥2 distinct sellers (meaningful split).
  if (groups.length < 2) return null;

  const t = await getTranslations('checkout.order_set_summary');

  return (
    <div
      data-testid="order-set-splits"
      className="rounded-sm border border-ui-border-base bg-ui-bg-base p-4"
    >
      <header className="mb-3">
        <h3 className="text-ui-fg-base txt-medium font-semibold">
          {t('heading')}
        </h3>
      </header>
      <ul className="divide-y divide-ui-border-base">
        {groups.map((group) => {
          const sellerId = group.seller_id ?? 'default';
          const sellerName = group.seller?.name ?? t('unknown_seller');
          const subtotalMinor = group.subtotal;
          const subtotalFormatted = new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: cart.currency_code?.toUpperCase() ?? 'PLN',
            minimumFractionDigits: 2,
          }).format(subtotalMinor / 100);

          return (
            <li
              key={sellerId}
              data-testid={`order-set-split-${sellerId}`}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-ui-fg-base font-medium">{sellerName}</span>
              <span className="text-ui-fg-muted">{subtotalFormatted}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
