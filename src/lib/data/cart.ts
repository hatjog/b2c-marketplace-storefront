'use server';

import type { HttpTypes } from '@medusajs/types';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

import type { CheckoutAddressInput, CheckoutAddressPayload } from '@/lib/checkout/address-payload';
import {
  resolveBridgePurchase,
  resolveCompletedOrderIds
} from '@/lib/checkout/completed-order-ids';
import { resolveStorefrontImageSrc } from '@/lib/helpers/asset-reference';
import { getMarketId } from '@/lib/helpers/market-filter';
import medusaError from '@/lib/helpers/medusa-error';
import { parseVariantIdsFromError } from '@/lib/helpers/parse-variant-error';
import {
  localeAwareFetch,
  localePath,
  resolveStorefrontLocaleSlug
} from '@/lib/sdk/locale-interceptor';
import type { EntitlementLineItemMetadata } from '@/lib/voucher/entitlement-metadata';
import {
  buildGiftRecipientIssueMetadata,
  type GiftRecipientFormData,
  type GiftRecipientIssueMetadata
} from '@/lib/voucher/gift-recipient';

import { fetchQuery, sdk } from '../config';
import { resolveMedusaBackendUrl } from '../env';
import { buildSellerLineItemMetadata } from '../helpers/vendor-product-traceability';
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
  setCartId,
  setCompletedCartId
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
 * v1.14.0 Story 2.3 (AC3) — locale ZAKUPU utrwalone w `cart.metadata`
 * (Option A, ten sam nośnik co snapshot flagi wyżej).
 *
 * Po co: mail potwierdzenia zakupu vouchera (FR-13) i gift-handoff (Story 2.4)
 * muszą iść w języku, w którym kupująca faktycznie kupowała. Backend nie ma
 * innego wiarygodnego nośnika tej informacji — koperta eventu
 * `entitlement_state_changed` nie niesie locale, a `Accept-Language` subscribera
 * nie istnieje. `cart.metadata` jest kopiowane do `order.metadata` przy
 * `completeCart`, więc subscriber czyta je z danych domenowych zamówienia
 * (projekcja `VoucherService.findBuyerClaimSource`).
 *
 * Kontrakt v1 (ADR-162): wartość = slug routingu storefrontu (`pl|en|ua|de`),
 * NIE BCP-47 — to ten sam alfabet, którym operuje `locales.supported` marketu
 * (D-55), więc backend waliduje ją bez tłumaczenia.
 *
 * Moment zapisu (R-2.3-H2): przy INICJACJI SESJI PŁATNOŚCI — czyli wtedy, gdy
 * kupująca wchodzi w krok płatności, a więc PRZED autoryzacją karty. NIE przy
 * tworzeniu koszyka (zamrażałoby język z momentu dodania pierwszego produktu)
 * i — co ważniejsze — NIE między `confirmCardPayment` a `/complete`.
 *
 * Dlaczego nie tuż przed `/complete`: `POST /store/carts/:id` uruchamia
 * `updateCartWorkflow` → `refreshCartItemsWorkflow` →
 * `refreshPaymentCollectionForCartWorkflow`, który KASUJE sesje płatności, gdy
 * przeliczona suma koszyka rozjedzie się z kwotą payment collection. W oknie
 * post-charge (karta już obciążona, `/complete` jeszcze nie) dałoby to
 * osierocone obciążenie — tę samą klasę incydentu co „błąd przetwarzania"
 * z v1.11.0. `try/catch` fail-open przed tym NIE chroni: szkodliwy jest
 * przypadek, w którym zapis SIĘ POWIEDZIE. Przy inicjacji sesji ten sam efekt
 * uboczny jest nieszkodliwy — sesja i tak powstaje zaraz po zapisie, a żadna
 * płatność nie została jeszcze autoryzowana.
 *
 * Semantyka ADR-162 „ostatni zapis wygrywa" zachowana: zapis biegnie przy
 * każdej inicjacji sesji płatności (zmiana metody / powrót do kroku płatności
 * po przełączeniu języka nadpisuje wartość).
 *
 * Zapis jest FAIL-OPEN: locale nie jest warunkiem sprzedaży, więc błąd
 * persystencji loguje ostrzeżenie i NIE wywraca checkoutu (backend ma jawny,
 * logowany fallback na `locales.default` rynku).
 */
const PURCHASE_LOCALE_KEY = 'purchase_locale';

/**
 * TF-73: Module-level mutex for getOrSetCart to prevent TOCTOU race condition.
 *
 * Problem: two concurrent addToCart calls for the same session (same server worker)
 * both call getOrSetCart → both see no cart → both create one → duplicate carts.
 *
 * Solution (Opcja B per Story TF-73 OQ#1): Module-level Promise-based lock keyed
 * by a stable session identifier. In Next.js server actions, each request gets a
 * server-side execution context; within the same Node.js process, concurrent calls
 * from the same session can be serialized via this Map.
 *
 * Timeout: 5s fallback to prevent lock starvation on unexpected failures.
 * Note: This protects against same-process concurrent calls. Cross-process/pod
 * races (multi-replica deployment) still require backend idempotency (future work).
 */
const cartCreationLocks = new Map<string, Promise<HttpTypes.StoreCart>>();
const CART_CREATION_LOCK_TTL_MS = 5_000;

/**
 * Story v160-5-9 — extracts flag snapshot z cart.metadata (Option A).
 * Returns `null` gdy snapshot missing — caller (placeOrder) treats this jako
 * fail-open Phase A per AC2 (backend mor-policy retains FM-9 guarantee).
 */
function readFlagSnapshotFromCart(
  cart: HttpTypes.StoreCart | null | undefined
): FlagSnapshot | null {
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

/**
 * Story 2.3 (AC3) — utrwala locale zakupu w `cart.metadata.purchase_locale`.
 *
 * Wywoływane przy inicjacji sesji płatności (patrz komentarz przy
 * `PURCHASE_LOCALE_KEY`), czyli PRZED autoryzacją karty. `cart.metadata` jest
 * kopiowane do `order.metadata` przy `completeCart`, więc wartość dociera do
 * subscribera bez dotykania koszyka w oknie post-charge.
 *
 * Fail-open: KAŻDY błąd (sieć, 4xx, brak koszyka) kończy się ostrzeżeniem
 * w logu i kontynuacją checkoutu — mail w języku fallbacku jest nieskończenie
 * lepszy niż nieudany zakup.
 *
 * Idempotentne w praktyce: powtórny zapis tej samej wartości jest pomijany
 * (oszczędza jedno zapytanie i nie unieważnia cache koszyka bez potrzeby).
 */
async function persistPurchaseLocale(
  cartId: string,
  headers: Record<string, string>
): Promise<void> {
  try {
    const locale = await resolveStorefrontLocaleSlug();
    const cart = await retrieveCart(cartId);

    if (!cart) {
      console.warn('[purchase-locale] brak koszyka do zapisu locale; kontynuacja fail-open');
      return;
    }

    const metadata = (cart.metadata ?? {}) as Record<string, unknown>;
    if (metadata[PURCHASE_LOCALE_KEY] === locale) {
      return;
    }

    await sdk.store.cart.update(
      cartId,
      {
        metadata: {
          ...metadata,
          [PURCHASE_LOCALE_KEY]: locale
        }
      },
      {},
      headers
    );

    const cartCacheTag = await getCacheTag('carts');
    revalidateTag(cartCacheTag);
  } catch (e) {
    // Fail-open per AC3 — locale to nie warunek sprzedaży.
    console.warn(
      '[purchase-locale] zapis purchase_locale nieudany; kontynuacja checkoutu fail-open',
      e
    );
  }
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
  '*shipping_address',
  '*billing_address',
  '*shipping_methods',
  'email',
  '+shipping_methods.name',
  // The `*seller` wildcard already serializes the real Seller columns (incl. `logo`),
  // which the cart avatar maps to `photo`. Do NOT add `+...seller.photo`: `photo` is not
  // a Seller column and the cart `fields` validator rejects the unknown nested field with
  // a 400 → retrieveCart catches it → null cart → checkout/payment breaks.
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

/**
 * TF-73: Internal cart creation helper — acquires module-level lock to prevent
 * TOCTOU duplicate cart creation. Returns existing cart if found, creates new one
 * if not. Keyed by countryCode as session proxy (reasonable approximation for
 * same-process concurrent calls).
 */
async function createCartIfMissing(countryCode: string): Promise<HttpTypes.StoreCart> {
  // Re-check cart after acquiring lock — a preceding concurrent call may have created it.
  let cart = await retrieveCart();
  if (cart) return cart;

  const region = await getRegion(countryCode);
  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`);
  }

  const headers = { ...(await getAuthHeaders()) };
  const cartResp = await sdk.store.cart.create({ region_id: region.id }, {}, headers);
  cart = cartResp.cart;

  await setCartId(cart.id);

  const cartCacheTag = await getCacheTag('carts');
  revalidateTag(cartCacheTag);

  return cart;
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
    // TF-73: Atomic check-then-set via module-level Promise lock.
    // Key is countryCode (session proxy). If another concurrent call is already
    // creating a cart, await its result instead of creating another one.
    const lockKey = `cart-create:${countryCode}`;
    let lockPromise = cartCreationLocks.get(lockKey);

    if (!lockPromise) {
      // We are the first — acquire lock and create cart.
      const creationPromise = createCartIfMissing(countryCode).finally(() => {
        // Release lock after creation (success or failure).
        cartCreationLocks.delete(lockKey);
      });
      // Set timeout to prevent lock starvation.
      const timeoutPromise = new Promise<HttpTypes.StoreCart>((_, reject) =>
        setTimeout(() => {
          cartCreationLocks.delete(lockKey);
          reject(new Error('[getOrSetCart] cart creation lock timeout'));
        }, CART_CREATION_LOCK_TTL_MS)
      );
      lockPromise = Promise.race([creationPromise, timeoutPromise]);
      cartCreationLocks.set(lockKey, lockPromise);
    }

    cart = await lockPromise;
  }

  // Story v160-5-9 — Atomic Flag Check, AC2 cart-start snapshot.
  // Idempotent: pierwszy zapis wygrywa (cart lifecycle = od first item do
  // completion lub cleanup). Defensive: zero crash gdy persistence fails
  // (fail-open Phase A — backend mor-policy retains FM-9 guarantee per
  // ADR-088-reassess).
  // cleanup-12d AC4 — TOCTOU guard: re-read before write (first-writer-wins).
  const existingSnapshot = readFlagSnapshotFromCart(cart);
  if (!existingSnapshot && cart) {
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
      console.warn(
        '[atomic-flag-check] cart-start snapshot persistence failed; proceeding fail-open',
        e
      );
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
 * Story 1.10.1 (v180-1-10-1-option-a-catalog-checkout-propagation): optional
 * `entitlement` parameter persists the embedded `entitlement_profile` triad
 * onto `cart_item.metadata` so the backend `stripe-payment-audit` workflow
 * can resolve `entitlement_profile` from `order_line_item.metadata` and
 * issue `entitlement_instance` on `payment.captured` (per ADR-099 Layer 4
 * + Story 2.1 + ADR-118 Path Y). Without this propagation,
 * `MissingEntitlementProfileError` is thrown for every BonBeauty paid order
 * (catalog→checkout propagation gap, investigation finding 2026-05-23).
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
  selectedSellerName,
  selectedSellerHandle,
  purchaseMode,
  entitlement
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
  /** cleanup-12d AC1 / TF-72 — seller handle for "/sellers/{handle}" link
   *  in CartGroupBySeller; persisted as cart_item metadata.selected_seller_handle. */
  selectedSellerHandle?: string | null;
  /** W1-04 PDP gift/self mode persisted for checkout recipient flow. */
  purchaseMode?: 'self' | 'gift';
  /** Story 1.10.1 — embedded entitlement_profile triad sourced from
   *  `product.metadata.gp.entitlement_profile` (set by gp-config-sync-catalog
   *  from market.yaml entitlement_profiles + products.yaml
   *  entitlement_profile_id cross-ref). Use `buildEntitlementLineItemMetadata`
   *  from `@/lib/voucher/entitlement-metadata` at the call site. Undefined for
   *  non-voucher-bearing products → metadata stays clean. */
  entitlement?: EntitlementLineItemMetadata;
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
  // TF-72: also include selected_seller_handle when present (enables CartGroupBySeller "visit seller" link).
  const sellerMetadata = buildSellerLineItemMetadata({
    selectedSellerId,
    selectedSellerName,
    selectedSellerHandle
  });
  const purchaseModeMetadata = purchaseMode
    ? {
        purchase_mode: purchaseMode,
        is_gift: purchaseMode === 'gift'
      }
    : undefined;
  // Story 1.10.1 GAP #1 — embedded entitlement_profile triad for the
  // stripe-payment-audit → issueEntitlementWithinPaymentTransaction →
  // resolveEntitlementProfile chain. Caller derives the fragment from
  // `product.metadata.gp.entitlement_profile` via
  // `buildEntitlementLineItemMetadata`. Non-voucher SKUs pass undefined →
  // no metadata noise, no backend behavior change (resolver short-circuit
  // remains unchanged for legacy items).
  const entitlementMetadata = entitlement ?? undefined;
  const lineItemMetadata =
    sellerMetadata || purchaseModeMetadata || entitlementMetadata
      ? {
          ...(sellerMetadata ?? {}),
          ...(purchaseModeMetadata ?? {}),
          ...(entitlementMetadata ?? {})
        }
      : undefined;

  if (currentItem) {
    await sdk.store.cart
      .updateLineItem(
        cart.id,
        currentItem.id,
        {
          quantity: currentItem.quantity + quantity,
          ...(lineItemMetadata
            ? { metadata: { ...(currentItem.metadata ?? {}), ...lineItemMetadata } }
            : {})
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
          ...(lineItemMetadata ? { metadata: lineItemMetadata } : {})
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

export async function updateGiftRecipientCartItems({
  lineItemIds,
  payload
}: {
  lineItemIds: string[];
  payload: GiftRecipientFormData | GiftRecipientIssueMetadata;
}) {
  const cartId = await getCartId();

  if (!cartId) {
    throw new Error('Missing cart ID when updating gift recipient data');
  }

  const cart = await retrieveCart();
  const targetIds = new Set(lineItemIds.filter(Boolean));
  const targetItems = (cart?.items ?? []).filter(item => targetIds.has(item.id));

  if (targetItems.length === 0) {
    throw new Error('Missing gift line item when updating gift recipient data');
  }

  const headers = {
    ...(await getAuthHeaders())
  };
  const giftRecipientMetadata =
    'gift_recipient_bound_to_voucher_issue' in payload
      ? payload
      : buildGiftRecipientIssueMetadata(payload);

  await Promise.all(
    targetItems.map(item =>
      sdk.store.cart.updateLineItem(
        cartId,
        item.id,
        {
          quantity: item.quantity,
          metadata: {
            ...(item.metadata ?? {}),
            purchase_mode: 'gift',
            is_gift: true,
            ...giftRecipientMetadata
          }
        },
        {},
        headers
      )
    )
  ).catch(medusaError);

  const cartCacheTag = await getCacheTag('carts');
  revalidateTag(cartCacheTag);
  revalidatePath('/checkout');
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
    data?: Record<string, unknown>;
    context?: Record<string, unknown>;
  },
  idempotencyKey?: string
) {
  const headers = {
    ...(await getAuthHeaders()),
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
  };

  // Story 2.3 (AC3) — locale zakupu utrwalane TUTAJ: to ostatni moment przed
  // autoryzacją płatności, w którym mutacja koszyka jest bezpieczna (sesja
  // płatności powstaje dopiero poniżej, więc ewentualne przeliczenie koszyka
  // nie może osierocić obciążenia). Fail-open w środku.
  if (cart?.id) {
    await persistPurchaseLocale(cart.id, headers);
    // Dowód dostępu do statusu zapisujemy JUŻ TERAZ, a nie dopiero po domknięciu
    // zamówienia: przy pełnym przekierowaniu 3DS/BLIK przeglądarka opuszcza
    // stronę i `completeOrderAfterStripePayment` nigdy się w niej nie wykona,
    // więc dowód zapisany po fakcie by nie powstał. Zapis jest nieszkodliwy —
    // dowód otwiera wyłącznie zamówienia, które ten koszyk realnie wyprodukuje.
    await setCompletedCartId(cart.id);
  }

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
    // Medusa StoreCart does not declare `promotions` in its public type but the API
    // returns it when promotions are active. Narrow locally; do not widen the upstream type.
    const cartWithPromos = cart as HttpTypes.StoreCart & {
      promotions?: Array<{ code?: string }>;
    };
    const applied = cartWithPromos.promotions?.some(
      p => typeof p.code === 'string' && codes.includes(p.code)
    );
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

  return localeAwareFetch(`${MEDUSA_BACKEND_URL}/store/carts/${cartId}/shipping-methods`, {
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

  return localeAwareFetch(`${MEDUSA_BACKEND_URL}/store/carts/${cartId}/promotions`, {
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

type StoreUpdateCartAddress = Exclude<
  HttpTypes.StoreUpdateCart['shipping_address'],
  string | undefined
>;

function toStoreCartAddress(address: CheckoutAddressInput): StoreUpdateCartAddress {
  return {
    first_name: address.first_name,
    last_name: address.last_name,
    address_1: address.address_1,
    address_2: address.address_2,
    company: address.company,
    postal_code: address.postal_code,
    city: address.city,
    country_code: address.country_code,
    province: address.province,
    phone: address.phone
  };
}

export async function setAddresses(currentState: unknown, payload: CheckoutAddressPayload) {
  try {
    if (!payload) {
      throw new Error('No address payload found when setting addresses');
    }
    const cartId = await getCartId();
    if (!cartId) {
      throw new Error('No existing cart found when setting addresses');
    }

    const shippingAddress = toStoreCartAddress(payload.shipping_address);
    const billingAddress =
      payload.same_as_billing || !payload.billing_address
        ? shippingAddress
        : toStoreCartAddress(payload.billing_address);

    const data: HttpTypes.StoreUpdateCart = {
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      email: payload.email
    };

    await updateCart(data);
    await revalidatePath(await localePath('/cart'));
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
  const res = await completeCartOrder(id);
  const orderIds = await resolveCompletedOrderIdsFromCompletion(res, id);
  // AD-16: przekierowanie prowadzi na JEDNO zamówienie, ale jest to DRILL-DOWN
  // z kolekcji, która nie jest tu obcinana — `orderIds` jedzie dalej kontraktem
  // (Story 3.7 renderuje wszystkie zamówienia potwierdzenia).
  const orderId = orderIds[0] ?? null;

  if (orderId) {
    // Ta sama zasada co w `completeOrderAfterStripePayment`: zapisz dowód
    // dostępu, zanim koszyk zniknie. To drugi, niezależny punkt domknięcia
    // zamówienia — pominięcie go zostawia gościa bez dostępu do statusu.
    if (id) {
      await setCompletedCartId(id);
    }
    // review-fix (HIGH): `await`. Bez niego odrzucenie tej obietnicy ucieka
    // poza `try/catch` jako unhandled rejection, a koszyk zostaje w cookie.
    await removeCartId();
    redirect(`/order/${orderId}/confirmed`);
  }

  return res;
}

async function completeCartOrder(cartId?: string) {
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

  // Story 2.3 (AC3): `purchase_locale` jest zapisywane przy inicjacji sesji
  // płatności (`initiatePaymentSession`), a NIE tutaj — między
  // `confirmCardPayment` a `/complete` nie wolno mutować koszyka (R-2.3-H2:
  // `updateCartWorkflow` może skasować sesje płatności → osierocone
  // obciążenie). Ten komentarz jest celowo zostawiony jako znacznik zakazu.

  const res = await fetchQuery(`/store/carts/${id}/complete`, {
    method: 'POST',
    headers
  });

  const cartCacheTag = await getCacheTag('carts');
  revalidateTag(cartCacheTag);

  return res;
}

/**
 * Odczyt kolekcji z endpointu mostkowego `GET /store/carts/:id/completed-order`.
 *
 * Retry 4×350 ms zostaje: join `order_set`↔cart potrafi opóźnić się o kilkaset
 * ms po domknięciu, a 404 był raportowany jako `no_order_id` i kupująca po
 * UDANEJ płatności dostawała komunikat „skontaktuj się z obsługą". To
 * uzasadnienie nie znika wraz z kardynalnością (Story 3.6).
 */
async function resolveCompletedPurchaseForCart(
  cartId: string,
  { attempts = 4, timeoutMs = 15_000 }: { attempts?: number; timeoutMs?: number } = {}
): Promise<{ orderIds: string[]; expectedOrderCount: number | null; readFailed: boolean }> {
  // Story 3.7 review-fix (HIGH-3, AD-19): „odczyt się nie udał" i „ten zakup nie
  // ma zamówień" MUSZĄ być odróżnialne u konsumenta. Do tej poprawki obie
  // sytuacje kończyły się identyczną pustą kolekcją, a powierzchnia mówiła
  // kupującej po obciążeniu karty „link jest nieaktualny" także wtedy, gdy to
  // backend leżał. `fetchQuery` nie rzuca dla HTTP 4xx/5xx (zwraca `ok: false`),
  // więc sam `try/catch` u wołającego łapał wyłącznie awarie transportowe.
  let readFailed = false;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetchQuery(`/store/carts/${cartId}/completed-order`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (res.ok) {
        // Story 3.7 (AC2): `order_count` z mostka jest JEDYNĄ licznością kontraktu
        // osiągalną dla powierzchni potwierdzenia. Do tej story była tu wyrzucana.
        const purchase = resolveBridgePurchase(res.data);
        if (purchase.orderIds.length > 0) {
          return { ...purchase, readFailed: false };
        }
        // Odpowiedź poprawna, ale pusta — to NIE jest porażka odczytu.
        readFailed = false;
      } else if (res.status === 404) {
        // 404 z mostka znaczy „nie ma takiego domkniętego zakupu" — to jest
        // stan dziedziny, a nie awaria. Ponawiamy (join `order_set`↔cart
        // potrafi się opóźnić), ale nie oznaczamy jako porażki odczytu.
        readFailed = false;
      } else if (res.status === 401 || res.status === 403) {
        // Odmowa jest terminalna i nie jest awarią domeny zakupu. Nie ponawiamy
        // jej i nie zapewniamy osoby bez dostępu, że cudza płatność jest bezpieczna.
        return { orderIds: [], expectedOrderCount: null, readFailed: false };
      } else {
        console.warn(
          `[confirmation] bridge read failed cart=${cartId} attempt=${attempt + 1} status=${res.status}`
        );
        readFailed = true;
      }
    } catch (error) {
      console.warn(`[confirmation] bridge read threw cart=${cartId} attempt=${attempt + 1}`, error);
      readFailed = true;
    }

    if (attempt < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }

  return { orderIds: [], expectedOrderCount: null, readFailed };
}

async function resolveCompletedOrderIdsForCart(
  cartId: string,
  { attempts = 4 }: { attempts?: number } = {}
): Promise<string[]> {
  return (await resolveCompletedPurchaseForCart(cartId, { attempts })).orderIds;
}

/**
 * Pełna rezolucja kardynalności dla domkniętego koszyka: najpierw z odpowiedzi
 * workflow (ogniwo 1), a gdy ta jej nie niesie — z endpointu mostkowego
 * (ogniwo 2). Granica upstreamu jest ZMIERZONA, nie założona: `OrderGroupDTO`
 * (`@mercurjs/types/dist/order-group/common.d.ts:1-11`) nie ma pola `orders`,
 * a `StoreCompleteCartResponse` (`@medusajs/types/dist/http/cart/store/
 * responses.d.ts:36-47`) niesie pojedyncze `order` — czyli dla koszyka
 * wielosprzedawcowego kolekcja MUSI powstać w ogniwie 2. Polityka upstream:
 * nie czekamy na fix po stronie Mercura.
 */
export async function resolveCompletedOrderIdsFromCompletion(
  res: any,
  cartId?: string
): Promise<string[]> {
  const fromWorkflow = resolveCompletedOrderIds(res);
  if (!cartId) {
    return fromWorkflow;
  }

  // review-fix (MEDIUM): mostek jest pytany ZAWSZE, gdy znamy koszyk — także
  // wtedy, gdy workflow zwrócił już więcej niż jedno zamówienie. Wcześniejsze
  // `fromWorkflow.length > 1 → return` opierało się na ZAŁOŻENIU, że skoro
  // workflow potrafi oddać N>1, to oddaje wszystkie. Liczność ogniwa 1 nie
  // została zmierzona wykonaniem (odczytano deklaracje typów, nie realny
  // przebieg), więc to założenie nie ma pokrycia. Poniższe `max` sprawia, że
  // kardynalność nie zależy od nieznanego zachowania upstreamu: mostek czyta
  // `order_cart` w bazie i jest autorytetem.
  //
  // Liczba prób jest RÓŻNA w dwóch sytuacjach i to jest celowe:
  //  • workflow nie dał NIC → mostek jest jedynym źródłem, więc pełne 4×350 ms
  //    (join `order_set`↔cart potrafi się opóźnić, a 404 był raportowany jako
  //    `no_order_id` po UDANEJ płatności);
  //  • workflow dał JEDNO zamówienie → mamy już użyteczną odpowiedź, więc
  //    jedno podejście bez czekania. Blokowanie kupującej na 1,4 s tylko po to,
  //    żeby potwierdzić liczność, byłoby regresją ścieżki jednosprzedawcowej —
  //    czyli tej jedynej, która jest dziś realnie przechodzona.
  const fromBridge = await resolveCompletedOrderIdsForCart(cartId, {
    attempts: fromWorkflow.length === 0 ? 4 : 1
  });

  return fromBridge.length > fromWorkflow.length ? fromBridge : fromWorkflow;
}

/**
 * Story 3.6 (AC2) — ODCZYT kardynalności dla koszyka, bez domykania.
 *
 * Ścieżka powrotu z 3DS musi najpierw sprawdzić, czy koszyk JUŻ jest domknięty
 * (odświeżenie / cofnięcie strony), zanim cokolwiek zainicjuje. Bez tego
 * odczytu każde ponowne wejście byłoby nową operacją domknięcia.
 *
 * review-fix (MEDIUM): ten odczyt MA RETRY. Pierwsza wersja robiła jedno
 * podejście bez czekania — dokładnie tam, gdzie lag joina `order_set`↔cart jest
 * najbardziej prawdopodobny. Skutek: koszyk JUŻ domknięty (inline albo
 * poprzednim żądaniem), ale join jeszcze nie dogonił ⇒ odczyt zwraca `[]`
 * ⇒ ścieżka powrotu inicjuje PONOWNE domknięcie zamiast odczytu, a idempotencja
 * opiera się wyłącznie na niezmierzonym zachowaniu `POST /complete` dla koszyka
 * już domkniętego. To podważało ten warunek AC2, który ten odczyt miał zapewnić.
 *
 * Liczba prób jest parametrem, bo koszt jest RÓŻNY w dwóch sytuacjach: przy
 * odświeżeniu retry kosztuje tylko czekanie na to, co i tak istnieje; przy
 * pierwszym wejściu każde podejście to czyste opóźnienie przed domknięciem.
 * Wywołujący ze ścieżki powrotu używa 2 podejść — pokrywa lag joina, nie
 * blokując kupującej na pełne 1,4 s.
 */
export async function getCompletedOrderIdsForCart(
  cartId: string,
  { attempts = 1 }: { attempts?: number } = {}
): Promise<string[]> {
  return resolveCompletedOrderIdsForCart(cartId, { attempts });
}

/**
 * v1.15.0 Story 3.7 (AC1/AC2) — ODCZYT CAŁEGO ZAKUPU dla powierzchni
 * potwierdzenia: kolekcja zamówień PLUS liczność z kontraktu mostka.
 *
 * `getCompletedOrderIdsForCart` (wyżej) zostaje bez zmian dla ścieżki powrotu
 * z 3DS, która liczności nie potrzebuje. Powierzchnia potwierdzenia potrzebuje
 * obu, bo bez liczności „pokazuję 1 z 2" jest nieodróżnialne od „zakup miał
 * jedno zamówienie" — a to jest dokładnie ten defekt, który nazywa AC2.
 */
export async function getCompletedPurchaseForCart(
  cartId: string,
  { attempts = 2, timeoutMs = 15_000 }: { attempts?: number; timeoutMs?: number } = {}
): Promise<{ orderIds: string[]; expectedOrderCount: number | null; readFailed: boolean }> {
  return resolveCompletedPurchaseForCart(cartId, { attempts, timeoutMs });
}

export async function completeOrderAfterStripePayment(cartId?: string) {
  try {
    const res = await completeCartOrder(cartId);
    const orderIds = await resolveCompletedOrderIdsFromCompletion(res, cartId);
    // AD-16: skalar jest DRILL-DOWNEM z `orderIds`, które lecą dalej w wyniku —
    // powierzchnia (Story 3.7) dostaje całość, nie pierwszy element.
    const orderId = orderIds[0] ?? null;

    if (!orderId) {
      // Completion returned no order — the payment was not captured (e.g. an
      // async BLIK/P24 push the customer never confirmed in their bank app).
      // Return a STABLE code, not an English sentence: the locale belongs to
      // the UI layer (the client component maps it via next-intl).
      return {
        ok: false,
        error: { code: 'no_order_id' as const }
      };
    }

    revalidatePath(await localePath('/user/reviews'));
    revalidatePath(await localePath('/user/orders'));
    // Dowód dostępu do statusu MUSI przeżyć skasowanie koszyka — kupująca bez
    // konta nie ma sesji, więc bez niego ekran płatności odbije ją 401-ką.
    // Rozwiązane id, nie surowy argument: funkcja jest eksportowana i sama
    // potrafi wziąć koszyk z cookie, więc `if (cartId)` cicho gubiłoby dowód.
    const completedCartId = cartId || (await getCartId());
    if (completedCartId) {
      await setCompletedCartId(completedCartId);
    }
    // review-fix (HIGH): `await` — patrz `placeOrder`. Tu było gorzej: brak
    // `await` sprawiał, że odrzucenie uciekało poza `try/catch` tej funkcji,
    // czyli poza jedyny mechanizm, który miał je zamienić w nazwany kod.
    await removeCartId();

    // `orderIds` niesie CAŁĄ kolekcję (Story 3.6, AD-16); `orderId` zostaje jako
    // drill-down dla dzisiejszych wywołujących, którzy routują na jedno zamówienie.
    return { ok: true, orderId, orderIds };
  } catch (error: any) {
    return {
      ok: false,
      error: {
        code: 'completion_failed' as const,
        // English detail kept for server logs only — never rendered.
        detail: error?.message?.replace('Error setting up the request: ', '')
      }
    };
  }
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
