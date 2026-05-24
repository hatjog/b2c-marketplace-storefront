/**
 * Generic Payment Status Landing — /[locale]/payment-status
 *
 * v1.9.1 Wave H2C: thin generic recovery surface for J3 persona contract
 * (F7 retry-href fix anti-regression). Order-scoped status lives at
 * `/[locale]/order/[id]/payment-status` (Story 2.4); this generic route
 * handles the unauthenticated / order-less / generic failure-redirect
 * case where a customer lands here without an order id (e.g. PSP
 * gateway redirect with status query but missing order_id).
 *
 * Surface contract:
 *   - SSR-rendered (no async backend dependency) — guaranteed 200 + retry
 *     CTA in DOM for E2E-C / J3 anti-regression.
 *   - Retry CTA href MUST NOT be "#" or empty (F-01 surface bug from F7).
 *   - Order-scoped flow remains the primary recovery path; this is a
 *     fallback / sentinel landing that funnels users back to cart.
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'payment_status' });
  return {
    title: t('page_title'),
    description: t('page_description'),
    robots: { index: false, follow: false },
  };
}

function normalizeStatus(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? 'unknown';
  return value ?? 'unknown';
}

export default async function GenericPaymentStatusPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = normalizeStatus(sp.status);
  const isFailed = status === 'failed' || status === 'error' || status === 'declined';

  return (
    <main
      className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-12 text-center"
      data-testid="generic-payment-status"
      data-status={status}
    >
      <h1 className="heading-lg mb-4 text-primary">
        {isFailed ? 'Płatność nie powiodła się' : 'Status płatności'}
      </h1>
      <p className="mb-6 text-base text-secondary" data-testid="generic-payment-status-body">
        {isFailed
          ? 'Wróć do koszyka i spróbuj ponownie. Jeśli problem się powtarza, skontaktuj się z naszym support.'
          : 'Aby sprawdzić status konkretnego zamówienia, otwórz link z e-maila potwierdzającego lub przejdź do panelu zamówień.'}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <LocalizedClientLink
          href="/cart"
          data-testid="payment-retry"
          className="rounded-full bg-action px-6 py-3 text-sm font-semibold text-on-action hover:opacity-90"
        >
          Spróbuj ponownie
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/user"
          className="rounded-full border border-tertiary/30 px-6 py-3 text-sm font-semibold text-secondary hover:bg-tertiary/10"
        >
          Moje zamówienia
        </LocalizedClientLink>
      </div>
    </main>
  );
}
