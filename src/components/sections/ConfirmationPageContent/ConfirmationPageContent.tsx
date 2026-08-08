'use client';

/**
 * v1.15.0 Story 3.7 (FR-7, FR-8 człon b, AD-16, AD-19) — powierzchnia
 * potwierdzenia CAŁEGO zakupu.
 *
 * ── Zmierzony stan sprzed tej story ────────────────────────────────────────
 * Komponent przyjmował `orderId: string` (`confirmed/page.tsx:39` podawało
 * `params.id`) i robił trzy fetch'e dla JEDNEGO identyfikatora
 * (`:235-259`). Zakup u dwóch sprzedawców — czyli JEDNO zamówienie NA
 * SPRZEDAWCĘ — pokazywał jako jedno zamówienie i nic na ekranie nie mówiło,
 * że drugie istnieje. Story 3.6 doprowadziła kolekcję do granicy komponentu
 * i zostawiła tu jawnie nazwany dług; ta story go spłaca.
 *
 * ── Co robi teraz ──────────────────────────────────────────────────────────
 * Przyjmuje ROZSTRZYGNIĘTY ZAKUP (`ConfirmationPurchase`, rozwinięty serwerowo
 * z segmentu trasy) i renderuje po jednej karcie NA ZAMÓWIENIE. Każda karta ma
 * własny odczyt, własne odpytywanie i własny stan terminalny — brak danych
 * jednego zamówienia jest stanem TEGO zamówienia, nie powodem, żeby wypadło
 * z listy.
 *
 * Liczność renderu jest PORÓWNYWANA z licznością kontraktu (`order_count`
 * z mostka `GET /store/carts/:id/completed-order`), a rozbieżność jest
 * NAZWANYM STANEM widocznym dla kupującej. Pokazanie 1 z 2 bez powiedzenia,
 * że to 1 z 2, jest defektem, który ta story usuwa (AC2).
 *
 * Ścieżka N = 1 celowo NIE zyskuje nowej ceremonii: nie ma nagłówka
 * „zamówienie 1 z 1" ani baneru liczności, bo to ona jest dziś jedyną realnie
 * przechodzoną (AC1).
 */

import { useCallback, useState } from 'react';

import { useTranslations } from 'next-intl';

import { CrossActorHandoff } from '@/components/molecules/CrossActorHandoff/CrossActorHandoff';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import type { ConfirmationPurchase } from '@/lib/confirmation/confirmation-purchase';
import { resolveConfirmationCardinality } from '@/lib/confirmation/order-confirmed-stepper';
import { resolveConfirmationHeroTone } from '@/lib/confirmation/order-confirmed-surface';

import { OrderConfirmationCard, type OrderCardOutcome } from './OrderConfirmationCard';

type Props = {
  purchase: ConfirmationPurchase;
};

/**
 * Stany bez kolekcji do wyrenderowania. KAŻDY ma własny nośnik tekstu i własny
 * `data-testid` — review-fix HIGH-3 dołożył `read_failed`, bo „nie udało nam
 * się odczytać zakupu" i „takiego zakupu nie ma" to dla kupującej po obciążeniu
 * karty dwie zupełnie różne wiadomości (AC3, AD-19).
 */
const EMPTY_PURCHASE_COPY: Record<
  'out_of_domain' | 'purchase_not_found' | 'read_failed',
  { testId: string; titleKey: string; bodyKey: string }
> = {
  out_of_domain: {
    testId: 'confirmation-out-of-domain',
    titleKey: 'out_of_domain_title',
    bodyKey: 'out_of_domain_body'
  },
  purchase_not_found: {
    testId: 'confirmation-purchase-not-found',
    titleKey: 'purchase_not_found_title',
    bodyKey: 'purchase_not_found_body'
  },
  read_failed: {
    testId: 'confirmation-read-failed',
    titleKey: 'purchase_read_failed_title',
    bodyKey: 'purchase_read_failed_body'
  }
};

export function ConfirmationPageContent({ purchase }: Props) {
  const t = useTranslations('confirmation');
  const [guestOrders, setGuestOrders] = useState<Record<string, boolean>>({});
  /**
   * Agregat stanu zakupu na potrzeby NAGŁÓWKA (review-fix MEDIUM-1). Do tej
   * poprawki hero renderował „✓ Zamówienie potwierdzone" bezwarunkowo — także
   * nad kartą mówiącą „Płatność nie doszła do skutku". Większy, wyżej i ze
   * znakiem potwierdzenia; dwa zdania sprzeczne na najbardziej stresującym
   * ekranie produktu.
   */
  const [orderOutcomes, setOrderOutcomes] = useState<Record<string, OrderCardOutcome>>({});

  const onGuestDetected = useCallback((orderId: string, isGuest: boolean) => {
    setGuestOrders(current =>
      current[orderId] === isGuest ? current : { ...current, [orderId]: isGuest }
    );
  }, []);

  const onOutcome = useCallback((orderId: string, outcome: OrderCardOutcome) => {
    setOrderOutcomes(current =>
      current[orderId] === outcome ? current : { ...current, [orderId]: outcome }
    );
  }, []);

  // ── Stany, w których nie ma czego renderować — każdy NAZWANY (AD-19) ─────
  if (
    purchase.kind === 'out_of_domain' ||
    purchase.kind === 'purchase_not_found' ||
    purchase.kind === 'read_failed'
  ) {
    const copy = EMPTY_PURCHASE_COPY[purchase.kind];
    return (
      <section
        className="bb-section-shell mx-auto max-w-3xl"
        data-testid={copy.testId}
        data-purchase-state={purchase.kind}
        role="alert"
      >
        <h1 className="heading-xl text-primary">{t(copy.titleKey)}</h1>
        <p className="mt-3 text-secondary">{t(copy.bodyKey)}</p>
        <LocalizedClientLink
          href="/user/orders"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta)]"
        >
          {t('recovery_cta')}
        </LocalizedClientLink>
      </section>
    );
  }

  const orderIds = purchase.orderIds;
  const rendered = orderIds.length;
  const isDrilldown = purchase.kind === 'drilldown';
  const cardinality = resolveConfirmationCardinality(rendered, purchase.expectedOrderCount);

  // Rozbieżność liczności jest widoczna zawsze, gdy istnieje. `unknown_expected`
  // pokazujemy tylko dla zakupu wielozamówieniowego: przy N = 1 z linku
  // zastanego brak liczności jest normą, nie anomalią, a straszenie kupującej
  // banerem na ścieżce, która działa, byłoby regresją (AC1 — bez nowej ceremonii).
  const showCardinalityNotice =
    cardinality.kind === 'partial' ||
    cardinality.kind === 'over_reported' ||
    (cardinality.kind === 'unknown_expected' && rendered > 1);

  // ── Agregat stanu zakupu dla nagłówka (review-fix MEDIUM-1) ──────────────
  //
  // `failed` liczymy WYŁĄCZNIE ze stanów terminalnych porażki raportowanych
  // przez karty. Karta, która jeszcze nie zaraportowała, jest `pending` — więc
  // nagłówek porażki nie pojawia się „na chwilę" w trakcie ładowania.
  const heroTone = resolveConfirmationHeroTone(orderIds, orderOutcomes);
  const heroTitleKey =
    heroTone === 'failure'
      ? 'hero_title_failure'
      : heroTone === 'partial'
        ? 'hero_title_partial'
        : 'hero_title';

  return (
    <div
      className="mx-auto max-w-6xl space-y-8"
      data-testid="order-confirmed-w1-07"
      data-purchase-state={purchase.kind}
      data-order-count={String(rendered)}
      data-expected-order-count={
        purchase.expectedOrderCount === null ? 'unknown' : String(purchase.expectedOrderCount)
      }
      data-cardinality={cardinality.kind}
      data-hero-tone={heroTone}
    >
      <header
        className="bb-section-shell bb-section-shell-strong relative overflow-hidden"
        data-testid="order-confirmed-hero"
        data-hero-tone={heroTone}
      >
        <div
          className="confirm-orna pointer-events-none absolute right-6 top-6 h-24 w-24 rounded-full border border-[var(--bb-border-strong)] opacity-40"
          aria-hidden="true"
          data-testid="confirm-orna"
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          {heroTone === 'success' ? (
            <div
              className="success-mark flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)] shadow-[var(--bb-shadow-card)]"
              aria-hidden="true"
              data-testid="order-confirmed-success-mark"
            >
              <span className="text-5xl leading-none">✓</span>
            </div>
          ) : (
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[var(--bb-border-error)] bg-[var(--bb-icon-bg-error,#fef5f5)] text-[var(--bb-border-error)] shadow-[var(--bb-shadow-card)]"
              aria-hidden="true"
              data-testid="order-confirmed-attention-mark"
            >
              <span className="text-5xl leading-none">!</span>
            </div>
          )}
          <div>
            <p className="bb-eyebrow">{t('hero_eyebrow')}</p>
            <h1
              className="heading-xl text-primary"
              data-testid="order-confirmed-hero-title"
            >
              {t(heroTitleKey)}
            </h1>
            {rendered > 1 && (
              <p
                className="mt-3 text-secondary"
                data-testid="purchase-order-count"
              >
                {/* Liczba jako NUMBER, nie string — inaczej ICU `plural`
                    nie ma czym rozstrzygnąć formy (review-fix LOW-2). */}
                {t('purchase_orders_count', { count: rendered })}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── Drill-down z linku zastanego — NAZWANY, nie udawany jako całość ── */}
      {isDrilldown && (
        <p
          className="bb-section-shell text-sm text-primary"
          data-testid="confirmation-drilldown-notice"
          role="status"
        >
          {t('drilldown_notice')}
        </p>
      )}

      {/* ── Rozbieżność liczności jako NAZWANY STAN (AC2) ─────────────────── */}
      {showCardinalityNotice && (
        <section
          className="bb-section-shell border border-[var(--bb-border-strong)] bg-[var(--bb-surface-muted)]"
          data-testid="confirmation-cardinality-notice"
          data-cardinality-kind={cardinality.kind}
          role="alert"
        >
          <h2 className="heading-sm text-primary">
            {cardinality.kind === 'partial' && t('cardinality_partial_title')}
            {cardinality.kind === 'over_reported' && t('cardinality_over_title')}
            {cardinality.kind === 'unknown_expected' && t('cardinality_unknown_title')}
          </h2>
          <p className="mt-2 text-sm text-secondary">
            {cardinality.kind === 'partial' &&
              t('cardinality_partial_body', {
                rendered: String(cardinality.rendered),
                expected: String(cardinality.expected)
              })}
            {cardinality.kind === 'over_reported' &&
              t('cardinality_over_body', {
                rendered: String(cardinality.rendered),
                expected: String(cardinality.expected)
              })}
            {cardinality.kind === 'unknown_expected' && t('cardinality_unknown_body')}
          </p>
          <LocalizedClientLink
            href="/user/orders"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta)]"
          >
            {t('recovery_cta')}
          </LocalizedClientLink>
        </section>
      )}

      <section
        aria-labelledby="purchase-orders-heading"
        data-testid="purchase-orders-section"
      >
        <h2
          id="purchase-orders-heading"
          className={rendered > 1 ? 'heading-sm mb-4 text-primary' : 'sr-only'}
        >
          {t('purchase_orders_title')}
        </h2>
        <ul
          className="space-y-6"
          data-testid="purchase-orders-list"
        >
          {orderIds.map((orderId, index) => (
            <li key={orderId}>
              <OrderConfirmationCard
                orderId={orderId}
                position={rendered > 1 ? index + 1 : null}
                total={rendered}
                onGuestDetected={onGuestDetected}
                onOutcome={onOutcome}
              />
            </li>
          ))}
        </ul>
      </section>

      <section
        className="bb-section-shell"
        data-testid="what-next-section"
        aria-labelledby="what-next-heading"
      >
        <h2
          id="what-next-heading"
          className="heading-sm text-primary"
        >
          {t('next_title')}
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <article className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-4">
            <span
              className="nc-ico mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)]"
              aria-hidden="true"
            >
              1
            </span>
            <h3 className="text-sm font-medium text-primary">{t('next_for_you_title')}</h3>
            <p className="mt-2 text-sm text-secondary">{t('next_for_you_body')}</p>
            <LocalizedClientLink
              href="/user/orders"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              {t('next_for_you_cta')}
            </LocalizedClientLink>
          </article>

          <article className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-4">
            <span
              className="nc-ico mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)]"
              aria-hidden="true"
            >
              2
            </span>
            <h3 className="text-sm font-medium text-primary">{t('next_for_recipient_title')}</h3>
            <p className="mt-2 text-sm text-secondary">{t('next_for_recipient_body')}</p>
            <LocalizedClientLink
              href={t('next_for_recipient_href')}
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              {t('next_for_recipient_cta')}
            </LocalizedClientLink>
          </article>

          <article className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-4">
            <span
              className="nc-ico mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)]"
              aria-hidden="true"
            >
              3
            </span>
            <h3 className="text-sm font-medium text-primary">{t('next_for_salon_title')}</h3>
            <p className="mt-2 text-sm text-secondary">{t('next_for_salon_body')}</p>
            <LocalizedClientLink
              href="/user/orders"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              {t('next_for_salon_cta')}
            </LocalizedClientLink>
          </article>
        </div>
      </section>

      <section
        className="bb-section-shell"
        data-testid="cross-actor-handoff-section"
      >
        <CrossActorHandoff
          forYou={t('cross_actor_for_you')}
          forUs={t('cross_actor_for_us')}
          labelForYou={t('cross_actor_label_for_you')}
          labelForUs={t('cross_actor_label_for_us')}
        />
      </section>

      {Object.values(guestOrders).some(Boolean) && (
        <section
          className="bb-section-shell"
          data-testid="guest-account-teaser"
        >
          <h2 className="heading-sm text-primary">{t('guest_teaser_title')}</h2>
          <p className="mt-2 text-secondary">{t('guest_teaser_body')}</p>
          <LocalizedClientLink
            href="/register"
            className="bb-primary-cta mt-4 inline-flex rounded-full px-6 py-3"
          >
            {t('guest_teaser_cta')}
          </LocalizedClientLink>
        </section>
      )}

      <footer
        className="slim-footer border-t border-[var(--bb-border-soft)] py-4 text-sm text-secondary"
        data-testid="order-confirmed-slim-footer"
      >
        {t('slim_footer')}
      </footer>
    </div>
  );
}
