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
 * v1.9.0 wf5 (H-4 / L-9 / F-CC1-007): collapse dual SSOTs.
 *
 * Per-market `payment.stripe.enabled_methods` (D6). Source of truth is
 * `GP/config/gp-dev/markets/<market>/market.yaml#payments.stripe.enabled_methods`.
 * BonBeauty live config currently lists 5 methods (card/blik/p24/apple_pay/
 * google_pay) — storefront aligned to the same 5 here (pre-v1.9.0 the
 * storefront hardcoded only 3 and silently dropped wallet methods). For
 * v1.10.0+ multi-market activation this MUST switch to a build-time codegen
 * step that reads the same gp-config YAML (planned: `gp-cli storefront
 * codegen` produces `src/lib/stripe/enabled-methods.generated.ts`); until
 * then the manual mirror is annotated with the parity validator
 * `_grow/tools/validate_stripe_enabled_methods_parity.py`.
 *
 * STRIPE_ENABLED_MARKETS is derived from the keys of this map (L-9 fix):
 * adding a market = a single change here, not two.
 */
const MARKET_ENABLED_METHODS: Record<string, readonly string[]> = {
  bonbeauty: ['card', 'blik', 'p24', 'apple_pay', 'google_pay']
};

/**
 * v1.9.0 wf5 L-9 fix: derive enabled markets from MARKET_ENABLED_METHODS keys
 * so adding a market requires updating a single map (was two: Set + Record).
 * Mirror Story 1.1 backend resolver `STRIPE_ENABLED_MARKETS`.
 */
const STRIPE_ENABLED_MARKETS = new Set<string>(Object.keys(MARKET_ENABLED_METHODS));

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
 * Per-market publishable key z env, przez STATYCZNE odwołanie do
 * `process.env.NEXT_PUBLIC_STRIPE_KEY_<MARKET>`.
 *
 * ⚠️ Next.js inline'uje do bundla klienta WYŁĄCZNIE statyczne odwołania
 * `process.env.NEXT_PUBLIC_*`. Dostęp dynamiczny (`process.env[`...${market}`]`)
 * NIE jest podmieniany przy buildzie i daje `undefined` po stronie klienta —
 * wcześniej powodowało to ciche pominięcie klucza per-market i fallback na
 * wspólny `NEXT_PUBLIC_STRIPE_KEY`. Dlatego klucze MUSZĄ być odwołane wprost
 * (switch), a nie składane z nazwy marketu. Lista musi pozostawać w parytecie
 * z `MARKET_ENABLED_METHODS` (docelowo zastąpione przez `gp-cli storefront
 * codegen`, patrz komentarz przy `MARKET_ENABLED_METHODS`).
 */
function perMarketPublishableKey(marketId: string): string | undefined {
  switch (marketId) {
    case 'bonbeauty':
      return process.env.NEXT_PUBLIC_STRIPE_KEY_BONBEAUTY;
    default:
      return undefined;
  }
}

/**
 * Per-market publishable key z env (NIE hardcoded, NIE sekret w repo).
 * Preferuje `NEXT_PUBLIC_STRIPE_KEY_<MARKET>`, fallback wspólny
 * `NEXT_PUBLIC_STRIPE_KEY`. `null` gdy market unconfigured albo brak klucza
 * → caller graceful reject (F-NEW-H2).
 */
export function getPublishableKey(marketId: string = getActiveMarketId()): string | null {
  if (!isStripeEnabledMarket(marketId)) return null;
  const perMarket = perMarketPublishableKey(marketId);
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
