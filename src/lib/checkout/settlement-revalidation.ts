import 'server-only';

/**
 * D-69 4-step cart settlement re-validation (per architecture.md L457-461 +
 * AC-FLAG-1.3-05):
 *
 *   Step 1 — Re-check `seller.status` immediately before payment capture.
 *            DB read, NOT cache (the resolver's per-request cache is bypassed
 *            here intentionally; we want the freshest committed state).
 *
 *   Step 2 — If status ∈ {paused, disabled, pending} → ABORT, emit
 *            `cart.settlement.aborted_by_seller_status`, return error w/ Polish
 *            customer-facing copy:
 *              `'Sprzedawca tymczasowo niedostępny — wybierz alternatywnego sprzedawcę'`
 *
 *   Step 3 — If `vendor_archive_fallback_enabled=true` AND status='disabled' →
 *            fallback to `market.fallback_vendor_id` per D-74 hybrid (do NOT
 *            settle on the original disabled seller).
 *
 *   Step 4 — Write `seller_status_change_audit` update with the cart-discovered
 *            `affected_orders[]` (the audit row INSERTed by the admin pause
 *            flow holds the in-flight orders snapshot; this step updates it
 *            via a compensating INSERT keyed on `seller_id + t1_db_commit`).
 *
 * The function is `'use server'` from the storefront perspective — it MUST be
 * invoked from a Server Action or a Route Handler, never from a client component
 * (AR-26 server-only segregation).
 *
 * @see _bmad-output/planning-artifacts/architecture.md L450-464 (D-69)
 * @see _bmad-output/planning-artifacts/architecture.md L766-767 (event payloads)
 */

export type SellerStatus = 'active' | 'paused' | 'disabled' | 'pending';

export type CartSettlementContext = {
  cartId: string;
  marketId: string;
  sellerId: string;
  customerSessionId: string;
  vendorArchiveFallbackEnabled: boolean;
  /**
   * Optional fallback vendor id from market config (D-74 hybrid). Required to
   * be non-null when `vendorArchiveFallbackEnabled === true`.
   */
  fallbackVendorId?: string | null;
};

export type CartSettlementOutcome =
  | { ok: true; resolvedSellerId: string; usedFallback: boolean }
  | {
      ok: false;
      code: 'SELLER_UNAVAILABLE';
      sellerStatus: SellerStatus;
      message: string;
      affectedCartId: string;
    };

const POLISH_UNAVAILABLE_MESSAGE =
  'Sprzedawca tymczasowo niedostępny — wybierz alternatywnego sprzedawcę';

/**
 * Port: re-read `seller.status` from the authoritative DB primary (no cache,
 * no replica). Implementations MUST hit the primary to avoid replica-lag
 * false-positives that would let `paused` orders through settlement.
 */
export type SellerStatusReader = (
  marketId: string,
  sellerId: string
) => Promise<SellerStatus>;

/**
 * Port: emit a PostHog event. Tests inject a recorder; runtime wires through
 * `posthog-node`.
 */
export type EventEmitter = (event: string, properties: Record<string, unknown>) => void;

/**
 * Port: write the cart-discovered audit update. Implementations INSERT a new
 * audit row (or PATCH `affected_orders[]` if the original row exists in this
 * tx — append-only enforcement on the audit table forbids true UPDATE).
 */
export type AuditAffectedOrdersWriter = (input: {
  marketId: string;
  sellerId: string;
  cartId: string;
  customerSessionId: string;
  observedStatus: SellerStatus;
}) => Promise<void>;

export type RevalidateDeps = {
  readSellerStatus: SellerStatusReader;
  emit: EventEmitter;
  writeAffectedOrders: AuditAffectedOrdersWriter;
  /** Wall-clock for test injection (Date.now equivalent). */
  now?: () => Date;
};

export async function revalidateSettlement(
  ctx: CartSettlementContext,
  deps: RevalidateDeps
): Promise<CartSettlementOutcome> {
  const now = deps.now ?? (() => new Date());

  // Step 1 — fresh DB read, no cache.
  const observed = await deps.readSellerStatus(ctx.marketId, ctx.sellerId);

  // Step 2 — abort on non-active.
  if (observed === 'paused' || observed === 'pending' || observed === 'disabled') {
    // Step 3 — archive fallback (only for disabled + flag on + fallback id present).
    if (
      observed === 'disabled' &&
      ctx.vendorArchiveFallbackEnabled &&
      ctx.fallbackVendorId
    ) {
      deps.emit('cart.settlement.fallback_to_archive_vendor', {
        schema: 'cart.settlement.fallback_to_archive_vendor.v1',
        market_id: ctx.marketId,
        cart_id: ctx.cartId,
        original_seller_id: ctx.sellerId,
        fallback_vendor_id: ctx.fallbackVendorId,
        customer_session_id: ctx.customerSessionId,
        observed_at: now().toISOString(),
      });

      // Step 4 — audit row update (cart-discovered).
      await deps.writeAffectedOrders({
        marketId: ctx.marketId,
        sellerId: ctx.sellerId,
        cartId: ctx.cartId,
        customerSessionId: ctx.customerSessionId,
        observedStatus: observed,
      });

      return { ok: true, resolvedSellerId: ctx.fallbackVendorId, usedFallback: true };
    }

    // Standard abort path.
    deps.emit('cart.settlement.aborted_by_seller_status', {
      schema: 'cart.settlement.aborted_by_seller_status.v1',
      market_id: ctx.marketId,
      cart_id: ctx.cartId,
      seller_id: ctx.sellerId,
      prior_status: 'active',
      current_status: observed,
      customer_session_id: ctx.customerSessionId,
      observed_at: now().toISOString(),
    });

    // Step 4 — write the audit affected_orders update.
    await deps.writeAffectedOrders({
      marketId: ctx.marketId,
      sellerId: ctx.sellerId,
      cartId: ctx.cartId,
      customerSessionId: ctx.customerSessionId,
      observedStatus: observed,
    });

    return {
      ok: false,
      code: 'SELLER_UNAVAILABLE',
      sellerStatus: observed,
      message: POLISH_UNAVAILABLE_MESSAGE,
      affectedCartId: ctx.cartId,
    };
  }

  // Active — happy path; settlement may proceed.
  return { ok: true, resolvedSellerId: ctx.sellerId, usedFallback: false };
}
