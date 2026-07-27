/**
 * payment-status-v180-config.ts — pure configuration helpers for 6-state payment surface.
 *
 * v1.8.0 Story 1.5: Payment Status Surface 6 States.
 *
 * Pure functions (no React, no hooks) extracted from PaymentStatusV180 component.
 * Enables unit testing of state→config mappings in node environment without jsdom.
 *
 * ARCH-007: Customer-facing storefront only.
 */

import type { PaymentStatusV180 } from './payment-status-v180-adapter';

/**
 * Returns the ARIA live region role for a given payment state.
 * - 'alert' (assertive): failed_nonretryable, support_required — irreversible errors
 * - 'status' (polite): all other states — non-urgent status updates
 */
export function getAriaLiveRole(status: PaymentStatusV180): 'alert' | 'status' {
  return status === 'failed_nonretryable' || status === 'support_required'
    ? 'alert'
    : 'status';
}

/**
 * Returns whether a given state has a primary CTA button.
 * pending_psp has no CTA (auto-poll only per AC4).
 */
export function hasPrimaryCta(status: PaymentStatusV180): boolean {
  return status !== 'pending_psp';
}

/**
 * Returns the navigation path for the CTA button (locale-aware).
 * Returns null for mailto: states (failed_nonretryable, support_required) — handled separately.
 * Returns null for pending_psp (no CTA).
 */
export function getCtaPath(
  status: PaymentStatusV180,
  orderId: string,
  locale: string,
): string | null {
  switch (status) {
    case 'paid':
      return `/${locale}/order/${orderId}/confirmed`;
    case 'failed_retryable':
      // Story 1.7 FR1.8 nav contract: pass orderId + retry_count for retry endpoint
      return `/${locale}/checkout?order_id=${encodeURIComponent(orderId)}&retry_count=1`;
    case 'expired':
      return `/${locale}/cart`;
    case 'failed_nonretryable':
    case 'support_required':
      return null; // mailto: — built separately
    case 'pending_psp':
      return null; // no CTA
  }
}

/**
 * Builds a properly URL-encoded mailto: href for support contact.
 */
export function buildSupportMailto(
  supportEmail: string,
  ticketId: string | null,
  orderId: string,
  orderLabel: string,
  ticketLabel: string,
): string {
  if (ticketId) {
    return `mailto:${supportEmail}?subject=${encodeURIComponent(`${ticketLabel} ${ticketId}`)}&body=${encodeURIComponent(`${orderLabel}: ${orderId}\n${ticketLabel}: ${ticketId}`)}`;
  }
  return `mailto:${supportEmail}?subject=${encodeURIComponent(orderLabel)}&body=${encodeURIComponent(`${orderLabel}: ${orderId}`)}`;
}

/** Powód, dla którego ekran statusu nie ma czego pokazać. */
export type PaymentStatusFetchError = 'access_denied' | 'access_denied_guest' | 'unavailable';

export type PaymentStatusErrorCopy = {
  titleKey: string;
  bodyKey: string;
  testId: string;
  /** 401/403 to komunikat wymagający uwagi, awaria backendu — nie. */
  assertive: boolean;
};

/**
 * Rozdziela „nie masz dostępu" od „nie udało się pobrać".
 *
 * Do v1.14.0 obie sytuacje renderowały `unavailable_body` („skontaktuj się
 * z obsługą klienta"), więc kupująca bez ważnej sesji dostawała diagnozę
 * awarii zamiast informacji, że wystarczy się zalogować. Mapowanie żyje tutaj,
 * a nie w komponencie, bo środowisko testowe tej powierzchni jest node-owe —
 * w komponencie ta gałąź byłaby niepokryta.
 */
export function getErrorCopy(fetchError: PaymentStatusFetchError | string | null): PaymentStatusErrorCopy {
  // 401 = brak dowodu uprawnienia. Dla kupującej BEZ konta rada „zaloguj się na
  // konto, z którego złożono zamówienie" jest niewykonalna — takiego konta nie
  // ma. Kierujemy ją tam, gdzie realnie ma link: do e-maila potwierdzającego.
  if (fetchError === 'access_denied_guest') {
    return {
      titleKey: 'payment_status.access_denied_title',
      bodyKey: 'payment_status.access_denied_guest_body',
      testId: 'payment-status-v180-access-denied',
      assertive: true,
    };
  }
  if (fetchError === 'access_denied') {
    return {
      titleKey: 'payment_status.access_denied_title',
      bodyKey: 'payment_status.access_denied_body',
      testId: 'payment-status-v180-access-denied',
      assertive: true,
    };
  }
  return {
    titleKey: 'payment_status.unavailable_title',
    bodyKey: 'payment_status.unavailable_body',
    testId: 'payment-status-v180-error',
    assertive: false,
  };
}
