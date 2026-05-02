'use server';

import type { HttpTypes } from '@medusajs/types';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

import medusaError from '@/lib/helpers/medusa-error';
import { parseVariantIdsFromError } from '@/lib/helpers/parse-variant-error';
import { resolveStorefrontImageSrc } from '@/lib/helpers/asset-reference';
import { getMarketId } from '@/lib/helpers/market-filter';

import { fetchQuery, sdk } from '../config';
import { resolveMedusaBackendUrl } from '../env';
import {
  FlagDriftError,
  snapshotFlagAtCartStart,
  verifyFlagUnchanged,
  type FlagSnapshot
} from '../security/flagAtomicCheck';
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId
} from './cookies';
import { getRegion } from './regions';

/**
 * Story v160-5-9 — flag snapshot keys w cart_metadata (Option A persistence).
 * Per ADR-088-reassess: storefront komplementarny do backend mor-policy.
 * Idempotent — pierwszy zapis wygrywa (`getOrSetCart` checks before write).
 */
const MVP_FLAG_SNAPSHOT_KEY = 'mvp_flag_snapshot';
const MVP_FLAG_SNAPSHOT_TS_KEY = 'mvp_flag_snapshot_ts';

/**
 * Story v160-5-9 — extracts flag snapshot z cart.metadata (Option A).
 * Returns `null` gdy snapshot missing — caller (placeOrder) treats this jako
 * fail-open Phase A per AC2 (backend mor-policy retains FM-9 guarantee).
 */
function readFlagSnapshotFromCart(cart: HttpTypes.StoreCart | null | undefined): FlagSnapshot | null {
  const metadata = cart?.metadata as Record<string, unknown> | null | undefined;
  if (!metadata) {
    return null;
  }
  const flagRaw = metadata[MVP_FLAG_SNAPSHOT_KEY];
  const tsRaw = metadata[MVP_FLAG_SNAPSHOT_TS_KEY];
  if (typeof flagRaw !== 'string' || typeof tsRaw !== 'string') {
    return null;
  }
  if (flagRaw !== 'true' && flagRaw !== 'false') {
    return null;
  }
  return { flag: flagRaw === 'true', ts: tsRaw };
}

const MEDUSA_BACKEND_URL = resolveMedusaBackendUrl();
const CART_RETRIEVE_FIELDS = [
  '*items',
  '*region',
  '*region.countries',
  '*items.product',
  '*items.variant',
  '*items.variant.options',
  'items.variant.options.option.title',
  '*items.thumbnail',
  '*items.metadata',
  'metadata',
  '+items.total',
  '+items.subtotal',
  '+items.tax_total',
  '+items.discount_total',
  '+items.discount_subtotal',
  'item_subtotal',
  'shipping_subtotal',
  'shipping_total',
  'tax_total',
  'discount_total',
  'discount_subtotal',
  'subtotal',
  'total',
  'currency_code',
  '*payment_collection',
  '*payment_collection.payment_sessions',
  '+payment_collection.payment_sessions.data',
  '*promotions',
  '+shipping_methods.name',
  '*items.product.seller'
].join(',');

type MedusaNumericLike =
  | number
  | string
  | null
  | undefined
  | {
      numeric_?: number | string;
      raw_?: {
        value?: string;
      };
    };

type StoreCartLineItemWithDiscountSubtotal = HttpTypes.StoreCartLineItem & {
  discount_subtotal?: MedusaNumericLike;
};

type StoreCartWithDiscountSubtotal = HttpTypes.StoreCart & {
  discount_subtotal?: MedusaNumericLike;
};

function normalizeMedusaNumeric(value: MedusaNumericLike): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (typeof value.numeric_ === 'number') {
    return Number.isFinite(value.numeric_) ? value.numeric_ : undefined;
  }

  if (typeof value.numeric_ === 'string' && value.numeric_.trim() !== '') {
    const parsed = Number(value.numeric_);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (typeof value.raw_?.value === 'string' && value.raw_.value.trim() !== '') {
    const parsed = Number(value.raw_.value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeCartLineItem(item: HttpTypes.StoreCartLineItem): HttpTypes.StoreCartLineItem {
  const lineItem = item as StoreCartLineItemWithDiscountSubtotal;
  const marketId = getMarketId();

  return {
    ...item,
    thumbnail: resolveStorefrontImageSrc(item.thumbnail, marketId),
    subtotal: normalizeMedusaNumeric(item.subtotal) ?? 0,
    total: normalizeMedusaNumeric(item.total) ?? 0,
    tax_total: normalizeMedusaNumeric(item.tax_total) ?? 0,
    discount_total: normalizeMedusaNumeric(item.discount_total) ?? 0,
    discount_subtotal: normalizeMedusaNumeric(lineItem.discount_subtotal) ?? 0,
    original_total: normalizeMedusaNumeric(item.original_total) ?? 0,
    unit_price: normalizeMedusaNumeric(item.unit_price) ?? item.unit_price
  } as HttpTypes.StoreCartLineItem;
}

function normalizeCart(cart: HttpTypes.StoreCart): HttpTypes.StoreCart {
  const normalizedCart = cart as StoreCartWithDiscountSubtotal;

  return {
    ...cart,
    item_subtotal: normalizeMedusaNumeric(cart.item_subtotal) ?? 0,
    shipping_subtotal: normalizeMedusaNumeric(cart.shipping_subtotal) ?? 0,
    shipping_total: normalizeMedusaNumeric(cart.shipping_total) ?? 0,
    tax_total: normalizeMedusaNumeric(cart.tax_total) ?? 0,
    discount_total: normalizeMedusaNumeric(cart.discount_total) ?? 0,
    discount_subtotal: normalizeMedusaNumeric(normalizedCart.discount_subtotal) ?? 0,
    subtotal: normalizeMedusaNumeric(cart.subtotal) ?? 0,
    total: normalizeMedusaNumeric(cart.total) ?? 0,
    items: cart.items?.map(normalizeCartLineItem)
  } as HttpTypes.StoreCart;
}

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export async function retrieveCart(cartId?: string) {
  const id = cartId || (await getCartId());

  if (!id) {
    return null;
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: 'GET',
      query: {
        fields: CART_RETRIEVE_FIELDS
      },
      headers,
      cache: 'no-cache'
    })
    .then(({ cart }) => normalizeCart(cart))
    .catch(() => null);
}

export async function getOrSetCart(countryCode: string) {
  const region = await getRegion(countryCode);

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`);
  }

  let cart = await retrieveCart();

  const headers = {
    ...(await getAuthHeaders())
  };

  if (!cart) {
    const cartResp = await sdk.store.cart.create({ region_id: region.id }, {}, headers);
    cart = cartResp.cart;

    await setCartId(cart.id);

    const cartCacheTag = await getCacheTag('carts');
    revalidateTag(cartCacheTag);
  }

  // Story v160-5-9 — Atomic Flag Check, AC2 cart-start snapshot.
  // Idempotent: pierwszy zapis wygrywa (cart lifecycle = od first item do
  // completion lub cleanup). Defensive: zero crash gdy persistence fails
  // (fail-open Phase A — backend mor-policy retains FM-9 guarantee per
  // ADR-088-reassess).
  const existingSnapshot = readFlagSnapshotFromCart(cart);
  if (!existingSnapshot) {
    try {
      const snapshot = snapshotFlagAtCartStart();
      const cartUpdateResp = await sdk.store.cart.update(
        cart.id,
        {
          metadata: {
            ...(cart.metadata ?? {}),
            [MVP_FLAG_SNAPSHOT_KEY]: snapshot.flag ? 'true' : 'false',
            [MVP_FLAG_SNAPSHOT_TS_KEY]: snapshot.ts
          }
        },
        {},
        headers
      );
      cart = cartUpdateResp.cart;
      const cartCacheTag = await getCacheTag('carts');
      revalidateTag(cartCacheTag);
    } catch (e) {
      // Fail-open per AC2 — log + proceed; backend mor-policy holds FM-9.
      console.warn('[atomic-flag-check] cart-start snapshot persistence failed; proceeding fail-open', e);
    }
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers);
    const cartCacheTag = await getCacheTag('carts');
    revalidateTag(cartCacheTag);
  }

  return cart;
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId();

  if (!cartId) {
    throw new Error('No existing cart found, please create one before updating');
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  return await sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }) => {
      const cartCacheTag = await getCacheTag('carts');
      await revalidateTag(cartCacheTag);
      return cart;
    })
    .catch(medusaError);
}

/**
 * Add product variant to cart.
 *
 * Story 5.5 (v160-5-5-vendor-context-preservation-cart): optional
 * `selectedSellerId` + `selectedSellerName` parameters persist multi-vendor
 * PDP selection as `cart_item.metadata.selected_seller_id` /
 * `selected_seller_name` for downstream grouping (Story 5.7) + Phase B+
 * fulfillment routing.
 *
 * Backward-compat: oba parametry optional (`undefined` lub `null` →
 * legacy single-vendor flow; zero metadata appended; existing callers
 * np. quick-buy w PLP card bez zmian).
 *
 * Persistence path (Option A — Mercur 2 / Medusa cart_item metadata):
 *  - Medusa types support `metadata?: Record<string, unknown>` na
 *    `StoreAddCartLineItem` payload (audit T2.3 Story 5.5).
 *  - Spread tylko gdy `selectedSellerId` non-null/non-empty — zero
 *    metadata noise w legacy flow.
 *  - Phase B+ checkout fulfillment reads `metadata.selected_seller_id`
 *    bez extra fetch.
 */
export async function addToCart({
  variantId,
  quantity,
  countryCode,
  selectedSellerId,
  selectedSellerName
}: {
  variantId: string;
  quantity: number;
  countryCode: string;
  /** Optional seller selection from multi-vendor PDP (Story 5.5);
   *  persisted as cart_item metadata for downstream grouping (Story 5.7). */
  selectedSellerId?: string | null;
  /** Denormalized seller name dla cart UI (zero extra fetch w cart render);
   *  Story 5.5 — paired z selectedSellerId. */
  selectedSellerName?: string | null;
}) {
  if (!variantId) {
    throw new Error('Missing variant ID when adding to cart');
  }

  const cart = await getOrSetCart(countryCode);

  if (!cart) {
    throw new Error('Error retrieving or creating cart');
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  const currentItem = cart.items?.find(item => item.variant_id === variantId);

  // Story 5.5 — only attach metadata gdy seller context provided. Defensive:
  // empty string treated jako absence (typescript-permissive callers).
  const sellerMetadata =
    selectedSellerId && selectedSellerName
      ? {
          selected_seller_id: selectedSellerId,
          selected_seller_name: selectedSellerName
        }
      : undefined;

  if (currentItem) {
    await sdk.store.cart
      .updateLineItem(
        cart.id,
        currentItem.id,
        {
          quantity: currentItem.quantity + quantity,
          ...(sellerMetadata ? { metadata: { ...(currentItem.metadata ?? {}), ...sellerMetadata } } : {})
        },
        {},
        headers
      )
      .catch(medusaError)
      .finally(async () => {
        const cartCacheTag = await getCacheTag('carts');
        revalidateTag(cartCacheTag);
      });
  } else {
    await sdk.store.cart
      .createLineItem(
        cart.id,
        {
          variant_id: variantId,
          quantity,
          ...(sellerMetadata ? { metadata: sellerMetadata } : {})
        },
        {},
        headers
      )
      .then(async () => {
        const cartCacheTag = await getCacheTag('carts');
        revalidateTag(cartCacheTag);
      })
      .catch(medusaError)
      .finally(async () => {
        const cartCacheTag = await getCacheTag('carts');
        revalidateTag(cartCacheTag);
      });
  }
}

export async function updateLineItem({ lineId, quantity }: { lineId: string; quantity: number }) {
  if (!lineId) {
    throw new Error('Missing lineItem ID when updating line item');
  }

  const cartId = await getCartId();

  if (!cartId) {
    throw new Error('Missing cart ID when updating line item');
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  const res = await fetchQuery(`/store/carts/${cartId}/line-items/${lineId}`, {
    body: { quantity },
    method: 'POST',
    headers
  });

  const cartCacheTag = await getCacheTag('carts');
  await revalidateTag(cartCacheTag);

  return res;
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error('Missing lineItem ID when deleting line item');
  }

  const cartId = await getCartId();

  if (!cartId) {
    throw new Error('Missing cart ID when deleting line item');
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag('carts');
      await revalidateTag(cartCacheTag);
    })
    .catch(medusaError);
}

export async function setShippingMethod({
  cartId,
  shippingMethodId
}: {
  cartId: string;
  shippingMethodId: string;
}) {
  const headers = {
    ...(await getAuthHeaders())
  };

  const res = await fetchQuery(`/store/carts/${cartId}/shipping-methods`, {
    body: { option_id: shippingMethodId },
    method: 'POST',
    headers
  });

  const cartCacheTag = await getCacheTag('carts');
  revalidateTag(cartCacheTag);

  return res;
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: {
    provider_id: string;
    context?: Record<string, unknown>;
  }
) {
  const headers = {
    ...(await getAuthHeaders())
  };

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async resp => {
      const cartCacheTag = await getCacheTag('carts');
      revalidateTag(cartCacheTag);
      return resp;
    })
    .catch(medusaError);
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId();

  if (!cartId) {
    return { success: false, error: 'No existing cart found' };
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  try {
    const { cart } = await sdk.store.cart.update(cartId, { promo_codes: codes }, {}, headers);
    const cartCacheTag = await getCacheTag('carts');
    revalidateTag(cartCacheTag);
    // @ts-ignore
    const applied = cart.promotions?.some((promotion: any) => codes.includes(promotion.code));
    return { success: true, applied };
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.message || error?.message || 'Failed to apply promotion code';
    return { success: false, error: errorMessage };
  }
}

export async function removeShippingMethod(shippingMethodId: string) {
  const cartId = await getCartId();

  if (!cartId) {
    throw new Error('No existing cart found');
  }

  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
    'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
  };

  return fetch(`${MEDUSA_BACKEND_URL}/store/carts/${cartId}/shipping-methods`, {
    method: 'DELETE',
    body: JSON.stringify({ shipping_method_ids: [shippingMethodId] }),
    headers
  })
    .then(async () => {
      const cartCacheTag = await getCacheTag('carts');
      revalidateTag(cartCacheTag);
    })
    .catch(medusaError);
}

export async function deletePromotionCode(promoId: string) {
  const cartId = await getCartId();

  if (!cartId) {
    throw new Error('No existing cart found');
  }
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
    'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
  };

  return fetch(`${MEDUSA_BACKEND_URL}/store/carts/${cartId}/promotions`, {
    method: 'DELETE',
    body: JSON.stringify({ promo_codes: [promoId] }),
    headers
  })
    .then(async () => {
      const cartCacheTag = await getCacheTag('carts');
      revalidateTag(cartCacheTag);
    })
    .catch(medusaError);
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    if (!formData) {
      throw new Error('No form data found when setting addresses');
    }
    const cartId = getCartId();
    if (!cartId) {
      throw new Error('No existing cart found when setting addresses');
    }

    const data = {
      shipping_address: {
        first_name: formData.get('shipping_address.first_name'),
        last_name: formData.get('shipping_address.last_name'),
        address_1: formData.get('shipping_address.address_1'),
        address_2: '',
        company: formData.get('shipping_address.company'),
        postal_code: formData.get('shipping_address.postal_code'),
        city: formData.get('shipping_address.city'),
        country_code: formData.get('shipping_address.country_code'),
        province: formData.get('shipping_address.province'),
        phone: formData.get('shipping_address.phone')
      },
      email: formData.get('email')
    } as any;

    // const sameAsBilling = formData.get("same_as_billing")
    // if (sameAsBilling === "on") data.billing_address = data.shipping_address
    data.billing_address = data.shipping_address;

    // if (sameAsBilling !== "on")
    //   data.billing_address = {
    //     first_name: formData.get("billing_address.first_name"),
    //     last_name: formData.get("billing_address.last_name"),
    //     address_1: formData.get("billing_address.address_1"),
    //     address_2: "",
    //     company: formData.get("billing_address.company"),
    //     postal_code: formData.get("billing_address.postal_code"),
    //     city: formData.get("billing_address.city"),
    //     country_code: formData.get("billing_address.country_code"),
    //     province: formData.get("billing_address.province"),
    //     phone: formData.get("billing_address.phone"),
    //   }

    await updateCart(data);
    await revalidatePath('/cart');
    return 'success';
  } catch (e: any) {
    return e.message;
  }
}

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId());

  if (!id) {
    throw new Error('No existing cart found when placing an order');
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  // Story v160-5-9 — AC3 pre-submit guard. Read snapshot z cart_metadata
  // (Option A); jeśli present → verifyFlagUnchanged → on drift throw
  // FlagDriftError (caller catch path obsługuje modal). Fail-open gdy
  // snapshot missing (backend mor-policy retains FM-9 guarantee per
  // ADR-088-reassess).
  try {
    const cart = await retrieveCart(id);
    const snapshot = readFlagSnapshotFromCart(cart);
    if (snapshot) {
      verifyFlagUnchanged(snapshot);
    } else {
      console.warn('[atomic-flag-check] no snapshot found, fail-open');
    }
  } catch (e) {
    if (e instanceof FlagDriftError) {
      throw e;
    }
    // Snapshot read errors (network, etc.) → fail-open per AC2.
    console.warn('[atomic-flag-check] snapshot read failed, fail-open', e);
  }

  const res = await fetchQuery(`/store/carts/${id}/complete`, {
    method: 'POST',
    headers
  });

  const cartCacheTag = await getCacheTag('carts');
  revalidateTag(cartCacheTag);

  if (res?.data?.order_group) {
    revalidatePath('/user/reviews');
    revalidatePath('/user/orders');
    removeCartId();
    redirect(`/order/${res?.data?.order_group.orders[0].id}/confirmed`);
  }

  return res;
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId();
  const region = await getRegion(countryCode);

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`);
  }

  if (cartId) {
    await updateCart({ region_id: region.id });
    const cartCacheTag = await getCacheTag('carts');
    revalidateTag(cartCacheTag);
  }

  const regionCacheTag = await getCacheTag('regions');
  revalidateTag(regionCacheTag);

  const productsCacheTag = await getCacheTag('products');
  revalidateTag(productsCacheTag);

  redirect(`/${countryCode}${currentPath}`);
}

/**
 * Updates the region and returns removed items for notification
 * This is a wrapper around updateRegion that doesn't redirect
 * Uses error-driven approach: tries to update, catches price errors, removes problem items, retries
 * @param countryCode - The country code to update to
 * @param currentPath - The current path for redirect
 * @returns Array of removed item names and new path
 */
export async function updateRegionWithValidation(
  countryCode: string,
  currentPath: string
): Promise<{ removedItems: string[]; newPath: string }> {
  const cartId = await getCartId();
  const region = await getRegion(countryCode);

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`);
  }

  let removedItems: string[] = [];

  if (cartId) {
    const headers = {
      ...(await getAuthHeaders())
    };

    try {
      await updateCart({ region_id: region.id });
    } catch (error: any) {
      // Check if error is about variants not having prices
      if (!error?.message?.includes('do not have a price')) {
        // Re-throw if it's a different error
        throw error;
      }

      // Parse variant IDs from error message
      const problematicVariantIds = parseVariantIdsFromError(error.message);

      // Early return if no variant IDs found
      if (!problematicVariantIds.length) {
        throw new Error('Failed to parse variant IDs from error');
      }

      // Fetch cart with minimal fields to get items
      try {
        const { cart } = await sdk.client.fetch<HttpTypes.StoreCartResponse>(
          `/store/carts/${cartId}`,
          {
            method: 'GET',
            query: {
              fields: '*items'
            },
            headers,
            cache: 'no-cache'
          }
        );

        // Iterate over problematic variants and remove corresponding items
        for (const variantId of problematicVariantIds) {
          const item = cart?.items?.find(item => item.variant_id === variantId);
          if (item) {
            try {
              await sdk.store.cart.deleteLineItem(cart.id, item.id, {}, headers);
              removedItems.push(item.product_title || 'Unknown product');
            } catch {
              // Silent failure - item removal failed but continue
            }
          }
        }

        // Retry region update after removing problematic items
        if (removedItems.length > 0) {
          await updateCart({ region_id: region.id });
        }
      } catch {
        throw new Error('Failed to handle incompatible cart items');
      }
    }

    // Revalidate caches
    const cartCacheTag = await getCacheTag('carts');
    revalidateTag(cartCacheTag);
  }

  const regionCacheTag = await getCacheTag('regions');
  revalidateTag(regionCacheTag);

  const productsCacheTag = await getCacheTag('products');
  revalidateTag(productsCacheTag);

  return {
    removedItems,
    newPath: `/${countryCode}${currentPath}`
  };
}

export async function listCartOptions() {
  const cartId = await getCartId();
  const headers = {
    ...(await getAuthHeaders())
  };
  const next = {
    ...(await getCacheOptions('shippingOptions'))
  };

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[];
  }>('/store/shipping-options', {
    query: { cart_id: cartId },
    next,
    headers,
    cache: 'force-cache'
  });
}
