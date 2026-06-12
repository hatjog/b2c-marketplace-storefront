/**
 * Per-seller shipping coverage for the checkout (orphaned-charge guard).
 *
 * Mercur 2 splits a cart into one order per seller (OrderSet), and
 * `POST /store/carts/:id/complete` REQUIRES a shipping method for every seller
 * whose items need shipping. The storefront, however, historically gated the
 * pay button on `cart.shipping_methods.length >= 1` only. A multi-seller cart
 * with a method for just one seller therefore passed the gate, the card was
 * charged (`confirmCardPayment`/`confirmPayment` runs BEFORE `/complete`), and
 * then `/complete` rejected with "No shipping method selected but the cart
 * contains seller items that require shipping" → no order, ORPHANED CHARGE.
 *
 * This pure helper mirrors the backend rule so the storefront can refuse to
 * charge until every required seller has a selected shipping method.
 *
 * The authoritative set of "sellers that require shipping" is the set of
 * sellers present in `GET /store/shipping-options?cart_id` (the backend only
 * returns options for sellers whose items need a method). We receive those as
 * the already-flattened `availableShippingMethods` (each carries `seller`).
 * A selected `cart.shipping_methods[].shipping_option_id` is mapped back to its
 * seller via the available options.
 */

export type ShippingSeller = { id: string; name?: string };

export type ShippingCoverage = {
  /** Sellers that have shipping options ⇒ must have a selected method. */
  requiredSellers: ShippingSeller[];
  /** Seller ids that already have a selected shipping method. */
  coveredSellerIds: string[];
  /** Required sellers still missing a selected method. */
  missingSellers: ShippingSeller[];
  /** True when every required seller is covered (safe to charge). */
  isComplete: boolean;
};

type AvailableMethodLike = {
  id?: string | null;
  seller?: { id?: string | null; name?: string | null } | null;
  seller_id?: string | null;
  seller_name?: string | null;
  rules?: Array<{ attribute?: string | null; value?: unknown } | null> | null;
};

// Structural input describing ONLY the fields this helper reads. Keeping it
// minimal (instead of `Omit<HttpTypes.StoreCart, ...>`) lets the real Medusa
// `StoreCart` (every field present ⇒ assignable) AND lightweight unit-test
// fixtures both satisfy it, without forcing ~23 unrelated `StoreCart` fields.
// Each member keeps a concrete property (`product` / `shipping_option_id`) so
// it is not an all-optional "weak type" that TS would reject on assignment.
type CartItemWithSeller = {
  product?: {
    // `id` is a real shared field with `HttpTypes.StoreProduct` so the full
    // Medusa product is assignable here — without an overlapping property TS
    // rejects the otherwise all-optional shape as a "weak type".
    id?: string;
    seller?: { id?: string | null; name?: string | null } | null;
  } | null;
};

type CartShippingMethodLike = {
  shipping_option_id?: string | null;
} | null;

export type CheckoutCartForShippingCoverage = {
  items?: CartItemWithSeller[] | null;
  shipping_methods?: CartShippingMethodLike[] | null;
};

function isReturnOption(m: AvailableMethodLike): boolean {
  return (m?.rules ?? []).some(
    r => r?.attribute === 'is_return' && r?.value === 'true'
  );
}

/**
 * Resolve the seller a shipping option/method belongs to. Falls back to the
 * cart's sole seller when the option carries no seller attribution (mirrors
 * the `fallbackSeller` behaviour in CartShippingMethodsSection for the common
 * single-seller checkout).
 */
function resolveSeller(
  m: AvailableMethodLike,
  cartSingleSeller: ShippingSeller | null
): ShippingSeller | null {
  const id = m?.seller?.id ?? m?.seller_id ?? null;
  if (id) {
    return { id, name: m?.seller?.name ?? m?.seller_name ?? undefined };
  }
  return cartSingleSeller;
}

export function getShippingCoverage(
  cart: CheckoutCartForShippingCoverage,
  availableShippingMethods: AvailableMethodLike[] | null | undefined
): ShippingCoverage {
  // Distinct sellers present in the cart's line items.
  const itemSellers = new Map<string, string | undefined>();
  for (const item of cart?.items ?? []) {
    const seller = item?.product?.seller;
    if (seller?.id) {
      itemSellers.set(seller.id, seller.name ?? undefined);
    }
  }
  const cartSingleSeller: ShippingSeller | null =
    itemSellers.size === 1
      ? { id: [...itemSellers.keys()][0], name: [...itemSellers.values()][0] }
      : null;

  // Selectable (non-return) options → option-id→seller map + required sellers.
  const optionSeller = new Map<string, ShippingSeller>();
  const requiredSellers = new Map<string, string | undefined>();
  for (const m of availableShippingMethods ?? []) {
    if (!m || isReturnOption(m)) continue;
    const seller = resolveSeller(m, cartSingleSeller);
    if (!seller) continue;
    if (m.id) optionSeller.set(m.id, seller);
    requiredSellers.set(seller.id, seller.name);
  }

  // Sellers covered by the currently-selected shipping methods.
  const coveredSellerIds = new Set<string>();
  for (const sm of cart?.shipping_methods ?? []) {
    const optionId = sm?.shipping_option_id;
    const seller = optionId ? optionSeller.get(optionId) : undefined;
    if (seller) coveredSellerIds.add(seller.id);
  }

  const missingSellers = [...requiredSellers.entries()]
    .filter(([id]) => !coveredSellerIds.has(id))
    .map(([id, name]) => ({ id, name }));

  return {
    requiredSellers: [...requiredSellers.entries()].map(([id, name]) => ({ id, name })),
    coveredSellerIds: [...coveredSellerIds],
    missingSellers,
    isComplete: missingSellers.length === 0
  };
}

/** Convenience: human-readable list of salons still missing a delivery method. */
export function missingShippingSellerNames(coverage: ShippingCoverage): string[] {
  return coverage.missingSellers.map((s, i) => s.name ?? `#${i + 1}`);
}
