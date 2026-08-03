import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { listOrderSetSplits } from '@/lib/data/order-sets';
import { convertToLocale } from '@/lib/helpers/money';

interface MultiVendorOrderSummaryProps {
  cart: HttpTypes.StoreCart | null;
}

/**
 * Story v160-cleanup-12e — checkout order_set splits projection.
 * Story v160-cleanup-15e — AC2/AC4 fix: dropped client-side
 *   `groupLineItemsBySeller` parallel computation; renders backend
 *   `/store/carts/:id/order-sets` response instead. Single computation
 *   path eliminates drift.
 *
 * Server Component rendered in the checkout sidebar. Backend short-circuits
 * to `{order_set_splits: []}` when the multi-vendor flag is not "on" (per
 * feature-flag-tri-state singleton oracle), so the component is a no-op
 * regardless of caller-side gating — but caller (checkout/page.tsx) keeps
 * the gate to avoid the unnecessary fetch.
 *
 * Internal guard: returns null when splits.length < 2 (single-vendor cart
 * or no seller metadata on any item) to avoid empty UI.
 *
 * data-testid="order-set-splits" — required by Story 8.8 AC6 Step 4 E2E.
 */
export async function MultiVendorOrderSummary({ cart }: MultiVendorOrderSummaryProps) {
  if (!cart?.id) return null;

  const splits = await listOrderSetSplits(cart.id);

  if (splits.length < 2) return null;

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
        {splits.map((split) => {
          const sellerName = split.seller_name ?? t('unknown_seller');
          const subtotalFormatted = convertToLocale({
            amount: split.subtotal,
            currency_code: cart.currency_code?.toUpperCase() ?? 'PLN',
            locale: 'pl-PL',
            isMinorUnit: true,
          });

          return (
            <li
              key={split.seller_id}
              data-testid={`order-set-split-${split.seller_id}`}
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
