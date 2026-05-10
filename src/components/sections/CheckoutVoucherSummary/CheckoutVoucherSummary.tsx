/**
 * CheckoutVoucherSummary — Server component.
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * Renders VoucherClaritySurface (UX-CMP-2, condensed) + SellerProofSurface
 * (UX-CMP-3) per seller group in the checkout review sidebar.
 *
 * Placement: rendered from checkout page server component ABOVE CartReview
 * (the 'use client' boundary stops server-component imports from crossing in).
 *
 * AC1 anchor: customer sees voucher rules, seller identity and
 * refund/cancellation policy before paying.
 *
 * ARCH-007: Customer-facing storefront only.
 * ARCH-003: Server component; no client code, no 'use client'.
 *
 * Review fixes applied:
 *   - F12: Replaced `(item as any).product?.seller` casts with the typed
 *     `MercurProduct.seller` shape (`SellerProps | null`). Items with a
 *     missing seller id are now logically skipped from grouping rather
 *     than silently grouped under `'unknown'`.
 *   - F13: Dropped the dead `async` modifier — this component does no IO
 *     of its own; child server components (`VoucherClaritySurface`,
 *     `SellerProofSurface`) handle their own async via RSC.
 *   - F14: Removed hardcoded PL strings (`'Salon'`, ` szt.`); both copy
 *     and unit are now served via `next-intl` (`getTranslations`).
 */

import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { VoucherClaritySurface } from '@/components/cells/VoucherClaritySurface/VoucherClaritySurface';
import { SellerProofSurface } from '@/components/cells/SellerProofSurface/SellerProofSurface';
import { convertToLocale } from '@/lib/helpers/money';
import { resolveValidityWording } from '@/lib/voucher/voucher-copy';
import type { MercurProduct } from '@/types/medusa-extensions';
import type { SellerProps } from '@/types/seller';

interface SellerGroup {
  seller: {
    id: string;
    name: string | null;
    handle: string | null;
    photo: string | null;
    rating: number | null;
    reviewCount: number | null;
  };
  items: HttpTypes.StoreCartLineItem[];
}

/** Narrow a cart line item's product into the typed Mercur extension. */
function getMercurProduct(item: HttpTypes.StoreCartLineItem): MercurProduct | null {
  // The Medusa cart line item type does not declare `product` on the public
  // API surface but Mercur's response includes it; we narrow safely here.
  const product = (item as unknown as { product?: MercurProduct | null }).product;
  return product ?? null;
}

/**
 * Reputation fields are not on the canonical `SellerProps` type but are
 * supplied by Mercur's enriched seller payload (rating + review_count).
 * Local narrow type lets us read them without resorting to `any`.
 */
type SellerWithReputation = SellerProps & {
  rating?: number | null;
  review_count?: number | null;
};

function groupItemsBySeller(cart: HttpTypes.StoreCart): SellerGroup[] {
  const grouped: Record<string, SellerGroup> = {};

  for (const item of cart.items ?? []) {
    const product = getMercurProduct(item);
    const seller = (product?.seller ?? null) as SellerWithReputation | null;
    const sellerId = seller?.id;
    if (!sellerId) {
      // F12 review fix: items without an identifiable seller are skipped
      // rather than silently grouped under a sentinel `'unknown'` key —
      // such items would previously hide a real data integrity bug.
      continue;
    }

    if (!grouped[sellerId]) {
      grouped[sellerId] = {
        seller: {
          id: sellerId,
          name: seller?.name ?? null,
          handle: seller?.handle ?? null,
          photo: seller?.photo ?? null,
          rating: seller?.rating ?? null,
          reviewCount: seller?.review_count ?? null,
        },
        items: [],
      };
    }
    grouped[sellerId].items.push(item);
  }

  return Object.values(grouped);
}

export function CheckoutVoucherSummary({
  cart,
}: {
  cart: HttpTypes.StoreCart;
}) {
  const groups = groupItemsBySeller(cart);

  if (groups.length === 0) return null;

  // RSC streams children that internally call getTranslations themselves.
  // We intentionally avoid additional async work here so the component
  // stays a thin grouping shell.
  return (
    <CheckoutVoucherSummaryContent groups={groups} cart={cart} />
  );
}

async function CheckoutVoucherSummaryContent({
  groups,
  cart,
}: {
  groups: SellerGroup[];
  cart: HttpTypes.StoreCart;
}) {
  const t = await getTranslations('checkout.voucher_summary');

  return (
    <div
      className="space-y-4"
      data-testid="checkout-voucher-summary"
    >
      {groups.map(group => {
        // Build VoucherClaritySurface props from the first item in the group
        // (in a voucher-first cart, all items in a seller group are from one seller).
        const firstItem = group.items[0];
        const product = getMercurProduct(firstItem);
        const gpMeta = (product?.metadata as { gp?: { validity_period?: string | null; refund_policy?: string | null } } | undefined)?.gp;

        const itemCount = group.items.length;
        // F14 review fix: localized "{seller} ({count} items)" headline; pluralized via i18n.
        const groupTitle =
          itemCount === 1
            ? firstItem.product_title ?? ''
            : t('group_title', {
                seller: group.seller.name ?? t('seller_fallback'),
                count: itemCount,
              });

        const totalFormatted = convertToLocale({
          amount: group.items.reduce((sum, it) => sum + (it.subtotal ?? 0), 0),
          currency_code: cart.currency_code,
        });

        const validityWording = resolveValidityWording(
          gpMeta?.validity_period ?? null,
          // Market default is owned by the runtime-market-assets layer;
          // wiring it into this surface is deferred to Story 2.5/2.9 where
          // confirmation/recovery copy actively need it. Story 2.4 surfaces
          // null when the product itself does not declare validity.
          null,
        );

        const refundCancellationInfo = gpMeta?.refund_policy ?? null;

        return (
          <div
            key={group.seller.id}
            className="space-y-3"
            data-testid={`checkout-seller-group-${group.seller.id}`}
          >
            {/* ─── VoucherClaritySurface condensed per seller group ──── */}
            <VoucherClaritySurface
              title={groupTitle}
              price={totalFormatted}
              validityWording={validityWording}
              refundCancellationInfo={refundCancellationInfo}
              merchantName={group.seller.name}
              merchantHandle={group.seller.handle}
              variant="condensed"
            />

            {/* ─── SellerProofSurface for last-mile trust ──────────── */}
            {group.seller.name && (
              <SellerProofSurface
                seller={{
                  name: group.seller.name,
                  handle: group.seller.handle,
                  photoUrl: group.seller.photo,
                  rating: group.seller.rating,
                  reviewCount: group.seller.reviewCount,
                }}
                className="mt-2"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
