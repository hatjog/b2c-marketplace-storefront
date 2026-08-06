/**
 * Payment Status Page — /[locale]/order/[id]/payment-status
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * Post-checkout status page. Customer lands here after PSP redirect or when
 * refreshing the status page. Displays the current payment/order state and
 * exactly ONE primary recovery path per shared lifecycle contract.
 *
 * CRITICAL: `dynamic = 'force-dynamic'` — payment/order/voucher state is
 * volatile. No ISR / no shared cache (`revalidate=300` banned per prd.md §Volatile
 * state rendering). Refresh must ALWAYS fetch live status from backend.
 *
 * AC3 compliance:
 *   - Timestamped status (real backend timestamp, never "just now").
 *   - Exactly one primary recovery CTA per status per FR8.
 *   - Ambiguous/unknown state → pending_psp_confirmation (never optimistic paid).
 *   - Refresh is a read; Retry is an explicit mutation (idempotency key per NFR8/NFR9).
 *
 * Idempotency (NFR8 / NFR9):
 *   - Page load / refresh calls status-READ endpoint only.
 *   - Retry CTA triggers payment retry via client action with fresh attempt key.
 *   - No duplicate order/charge from back-button / second tab.
 *
 * Story 2.5 handoff:
 *   - `paid` state → Continue → /order/[id]/confirmed (ConfirmationHandoff owned by 2.5).
 *   - This page does NOT render voucher delivery copy (ANTI-PATTERN per spec).
 *
 * ARCH-007: Customer-facing storefront.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { PaymentReturnAutoRefresh } from '@/components/sections/PaymentReturnNotice/PaymentReturnAutoRefresh';
import { PaymentReturnNotice } from '@/components/sections/PaymentReturnNotice/PaymentReturnNotice';
import { PaymentStatusV180 } from '@/components/sections/PaymentStatusV180/PaymentStatusV180';
import { resolvePaymentReturn } from '@/lib/data/payment-return';

// CRITICAL: force-dynamic — payment status is volatile; no shared ISR cache.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'payment_status' });
  return {
    title: t('page_title'),
    description: t('page_description'),
    // No index — payment status pages should not be indexed by search engines.
    robots: { index: false, follow: false }
  };
}

/**
 * v1.15.0 Story 3.6 (AC2/AC3/AC4) — ta strona jest KOŃCEM kontraktu powrotu 3DS.
 *
 * Do v1.15.0 robiła przy każdym renderze dokładnie to samo: brała `params.id`
 * (który przy powrocie ze Stripe'a jest KOSZYKIEM, nie zamówieniem) i podawała
 * go dalej jako `orderId`. `searchParams` było zadeklarowane w typie `Props`
 * i nigdy nieodczytane, więc `redirect_status` — jedyny sygnał odróżniający
 * porzucone uwierzytelnienie od udanego — nie miał w repo konsumenta.
 *
 * Teraz powrót jest domykany SERWEROWO, a rodzaj identyfikatora jest
 * rozstrzygany, nie zakładany. `force-dynamic` zostaje: stan płatności jest
 * zmienny, ISR jest tu zakazane.
 *
 * ── review-fix (HIGH): ten render NIC nie mutuje ───────────────────────────
 * Pierwsza wersja wołała stąd `completeOrderAfterStripePayment`, czyli
 * `revalidateTag`/`revalidatePath` i zapis cookies — operacje, których Next.js
 * zabrania w renderze. Wyjątek leciał PO udanym `POST /complete`, więc
 * zamówienia powstawały, a kupująca widziała „czekamy na potwierdzenie".
 * Teraz `resolvePaymentReturn` jest czystym ODCZYTEM, a gdy koszyk wymaga
 * domknięcia, strona PRZEKIEROWUJE na Route Handler
 * (`/api/v1/checkout/payment-return`), gdzie mutacja jest legalna. Handler
 * odsyła tu z powrotem ze znacznikiem `gp_return=done`, który zamyka pętlę.
 */
export default async function PaymentStatusPage(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(params.locale);

  const { result, completionRedirect } = await resolvePaymentReturn(
    params.id,
    searchParams,
    params.locale
  );

  if (completionRedirect) {
    // `redirect()` rzuca — to jest jedyne „wyjście mutujące" z tego renderu
    // i samo w sobie mutacją nie jest.
    redirect(completionRedirect);
  }

  return (
    <main
      id="main-content"
      className="container py-8"
    >
      <StorefrontRouteStateSignal
        route="payment-status"
        surface="payment-status"
        stateInput={{ is_pending: result.state !== 'confirmed' }}
      />
      <StorefrontI18nLongContentProbe
        locale={params.locale}
        surface="payment-status"
      />
      {result.state === 'confirmed' ? (
        <PaymentStatusV180 orderIds={result.orderIds} />
      ) : (
        <>
          <PaymentReturnNotice
            locale={params.locale}
            result={result}
            cartHref={`/${params.locale}/cart`}
          />
          {/* review-fix (MEDIUM): `pending_confirmation` to jedyny stan, który
              może się jeszcze sam rozstrzygnąć (async push BLIK/P24). Przed tą
              story rozstrzygał się automatycznie przez `usePaymentStatusPoll`;
              maszyna stanów to odpytywanie zgubiła. Stany terminalne
              (`authentication_abandoned`, `identifier_out_of_domain`) świadomie
              go NIE dostają — odpytywanie stanu, który się nie zmieni, jest
              kolejnym martwym mechanizmem. */}
          {result.state === 'pending_confirmation' && <PaymentReturnAutoRefresh />}
        </>
      )}
    </main>
  );
}
