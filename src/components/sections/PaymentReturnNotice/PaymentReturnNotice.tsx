/**
 * v1.15.0 Story 3.6 (AC4, NFR-2, NFR-7) — powierzchnia stanów powrotu z 3DS,
 * które NIE są potwierdzeniem.
 *
 * Trzy stany, trzy różne komunikaty i trzy różne akcje. Żaden nie kończy się
 * ciszą ani optymistycznym „opłacone" bez potwierdzenia ze strony serwera.
 *
 * Komponent jest serwerowy: stan jest już rozstrzygnięty przez
 * `resolvePaymentReturn`, więc nie ma tu nic do odpytywania po stronie klienta.
 * Wszystkie teksty idą przez klucze i18n w namespace `payment_status`.
 */

import { getTranslations } from 'next-intl/server';

import type { PaymentReturnState } from '@/lib/checkout/payment-return-state';

export interface PaymentReturnNoticeProps {
  locale: string;
  result: Exclude<PaymentReturnState, { state: 'confirmed' }>;
  /** Ścieżka powrotu do koszyka — jedyna akcja naprawcza tych stanów. */
  cartHref: string;
}

/** Stan → wariant wizualny + rola ARIA. Jeden punkt mapowania, bez `default`. */
function presentationFor(state: PaymentReturnNoticeProps['result']['state']): {
  container: string;
  role: 'alert' | 'status';
} {
  switch (state) {
    case 'authentication_abandoned':
      return {
        container: 'border-warning-700 bg-warning-50 text-primary',
        role: 'alert'
      };
    case 'pending_confirmation':
      return {
        container: 'border-primary bg-tertiary text-primary',
        role: 'status'
      };
    case 'identifier_out_of_domain':
      return {
        container: 'border-negative bg-negative/10 text-primary',
        role: 'alert'
      };
  }
}

export async function PaymentReturnNotice({ locale, result, cartHref }: PaymentReturnNoticeProps) {
  const t = await getTranslations({ locale, namespace: 'payment_status' });
  const { container, role } = presentationFor(result.state);
  const keyBase = `return_${result.state}`;

  return (
    <section
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      data-testid="payment-return-notice"
      data-return-state={result.state}
      data-return-reason={'reason' in result ? result.reason : undefined}
      className={`rounded-sm border p-6 ${container}`}
    >
      <h1 className="heading-md mb-2">{t(`${keyBase}.label`)}</h1>
      <p className="label-md mb-4">{t(`${keyBase}.body`)}</p>
      <a
        href={cartHref}
        className="label-md inline-flex items-center rounded-sm border border-primary px-4 py-2 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t(`${keyBase}.cta`)}
      </a>
    </section>
  );
}
