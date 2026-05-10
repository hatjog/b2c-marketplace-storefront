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
 */

import type { HttpTypes } from '@medusajs/types';

import { VoucherClaritySurface } from '@/components/cells/VoucherClaritySurface/VoucherClaritySurface';
import { SellerProofSurface } from '@/components/cells/SellerProofSurface/SellerProofSurface';
import { convertToLocale } from '@/lib/helpers/money';
import { resolveValidityWording } from '@/lib/voucher/voucher-copy';

interface SellerGroup {
  seller: {
    id: string;
    name?: string | null;
    handle?: string | null;
    photo?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
  };
  items: HttpTypes.StoreCartLineItem[];
}

function groupItemsBySeller(cart: HttpTypes.StoreCart): SellerGroup[] {
  const grouped: Record<string, SellerGroup> = {};

  for (const item of cart.items ?? []) {
    const seller = (item as any).product?.seller;
    const sellerId = seller?.id ?? 'unknown';

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

export async function CheckoutVoucherSummary({
  cart,
}: {
  cart: HttpTypes.StoreCart;
}) {
  const groups = groupItemsBySeller(cart);

  if (groups.length === 0) return null;

  return (
    <div
      className="space-y-4"
      data-testid="checkout-voucher-summary"
    >
      {groups.map(group => {
        // Build VoucherClaritySurface props from the first item in the group
        // (in a voucher-first cart, all items in a seller group are from one seller).
        const firstItem = group.items[0];
        const product = (firstItem as any)?.product;
        const gpMeta = product?.metadata?.gp;

        const title = group.items.length === 1
          ? firstItem.product_title ?? ''
          : `${group.seller.name ?? 'Salon'} (${group.items.length} szt.)`;

        const totalFormatted = convertToLocale({
          amount: group.items.reduce((sum, it) => sum + (it.subtotal ?? 0), 0),
          currency_code: cart.currency_code,
        });

        const validityWording = resolveValidityWording(
          gpMeta?.validity_period ?? null,
          null, // market default — not available server-side here
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
              title={title}
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
