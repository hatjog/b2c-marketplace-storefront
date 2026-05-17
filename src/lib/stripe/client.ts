/**
 * Stripe.js client init + per-market resolution (storefront side).
 *
 * Story 1.4 (v1.8.0) — AC1/AC4. Konsumuje WZORZEC Story 1.1
 * (`GP/backend/packages/api/src/lib/secrets/market-resolver.ts`):
 * `STRIPE_ENABLED_MARKETS` Set (v1.8.0: tylko `bonbeauty`) + uniform
 * graceful reject dla unconfigured markets (F-NEW-H2 — identyczny komunikat
 * "Payment is not available for this market", NIE market-specific). To NIE
 * jest re-implementacja resolvera — to storefront-side mirror tej samej
 * macierzy enablement (D6/D10), bez sekretów w repo.
 *
 * Publishable key per-market przez env (NEXT_PUBLIC_, build-embedded —
 * spójne z `src/lib/helpers/market-filter.ts` constraint). Schemat:
 *   NEXT_PUBLIC_STRIPE_KEY_<MARKET_UPPER>  → preferowany per-market klucz
 *   NEXT_PUBLIC_STRIPE_KEY                 → wspólny fallback (BonBeauty-only v1.8.0)
 * NIGDY hardcoded klucz; placeholdery wyłącznie `pk_test_…` w env/.env.local.
 *
 * [Source: 1-1-stripe-provider-registration-resolver.md#market-resolver
 *  (STRIPE_ENABLED_MARKETS / F-NEW-H2); architecture.md#D6 enabled_methods;
 *  specs/releases/v1.8.0/architecture.md#D-V180-ARCH-12]
 */
import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * F-NEW-H2 uniform reject message — IDENTYCZNY dla wszystkich unconfigured
 * markets (NIE market-specific), spójny ze Story 1.1 backend resolverem.
 */
export const PAYMENT_NOT_AVAILABLE_MESSAGE = 'Payment is not available for this market';

/**
 * Markets z aktywnym Stripe w v1.8.0 (D10). Mirror Story 1.1
 * `STRIPE_ENABLED_MARKETS` — tylko BonBeauty; pozostałe 4 markety
 * (bonevent/bongarden/mercur/testmarketb) → graceful reject. Rozszerzenie
 * = v1.10.0+ (poza scope tej story).
 */
const STRIPE_ENABLED_MARKETS = new Set<string>(['bonbeauty']);

/**
 * Per-market `payment.stripe.enabled_methods` (D6). Schema autorowana
 * w Story 0.17; storefront czyta aktywny market i mapuje na Stripe
 * `paymentMethodTypes`. BonBeauty: card/blik/p24.
 */
const MARKET_ENABLED_METHODS: Record<string, readonly string[]> = {
  bonbeauty: ['card', 'blik', 'p24']
};

/** Aktywny market id (build-embedded, spójne z market-filter helper). */
export function getActiveMarketId(): string {
  return process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
}

/** Czy market ma skonfigurowany Stripe (D10 enablement matrix). */
export function isStripeEnabledMarket(marketId: string): boolean {
  return STRIPE_ENABLED_MARKETS.has(marketId);
}

/**
 * Lista `paymentMethodTypes` dla PaymentElement per active market (AC1/D6).
 * Market poza enablement matrix → `null` (graceful reject — caller NIE
 * renderuje PaymentElement, pokazuje F-NEW-H2 uniform message).
 */
export function getEnabledPaymentMethodTypes(
  marketId: string = getActiveMarketId()
): readonly string[] | null {
  if (!isStripeEnabledMarket(marketId)) return null;
  return MARKET_ENABLED_METHODS[marketId] ?? null;
}

/**
 * Per-market publishable key z env (NIE hardcoded, NIE sekret w repo).
 * Preferuje `NEXT_PUBLIC_STRIPE_KEY_<MARKET>`, fallback wspólny
 * `NEXT_PUBLIC_STRIPE_KEY`. `null` gdy market unconfigured albo brak klucza
 * → caller graceful reject (F-NEW-H2).
 */
export function getPublishableKey(marketId: string = getActiveMarketId()): string | null {
  if (!isStripeEnabledMarket(marketId)) return null;
  const perMarket = process.env[`NEXT_PUBLIC_STRIPE_KEY_${marketId.toUpperCase()}`];
  const key = perMarket || process.env.NEXT_PUBLIC_STRIPE_KEY;
  return key && key.trim() ? key : null;
}

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

/**
 * `stripePromise` per-market — memoizowany per publishable key (Stripe.js
 * zaleca single `loadStripe` per key). Zwraca `null` gdy market
 * unconfigured / brak klucza (AC1 graceful reject — NIE crash, caller
 * pokazuje F-NEW-H2 message zamiast PaymentElement).
 */
export function getStripePromise(
  marketId: string = getActiveMarketId()
): Promise<Stripe | null> | null {
  const key = getPublishableKey(marketId);
  if (!key) return null;
  let cached = stripePromiseCache.get(key);
  if (!cached) {
    cached = loadStripe(key);
    stripePromiseCache.set(key, cached);
  }
  return cached;
}
