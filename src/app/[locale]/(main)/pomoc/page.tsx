/**
 * Story v170-2-9: Help / FAQ page — consumer withdrawal and voucher support.
 *
 * Route: /[locale]/pomoc
 *
 * PL-first naming (consistent with `/regulamin`, `/zasady`, `/polityka-prywatnosci`).
 * Covers: how withdrawal works, consent-to-execute, support-review meaning, support contact.
 *
 * SEO: robots noindex/nofollow — pre-prod posture per story constraint.
 * Rendering: dynamic (NOT force-static).
 *
 * IMPORTANT: This page covers consumer-purchase withdrawal (FR64) ONLY.
 * RODO Art. 7/17 recipient-PII consent is handled elsewhere.
 *
 * Review fixes applied:
 *   H1 — bind to existing storefront tokens (--text-*, --color-*, --bg-action,
 *        --bb-surface*, --bb-border-soft); no invented `--bb-*` names.
 *   H3 — render `VoucherWithdrawalStateCard` so the Epic 7 DOM signal landmark
 *        exists on a stable, indexable surface.
 *   M4 — split next-intl handle: `voucher_withdrawal` for `state_*`,
 *        `voucher_withdrawal.legal` for legal page strings.
 *   M7 — `generateMetadata` reads from i18n, not hardcoded PL strings.
 *   L4 — `mailto:` CTA uses Tailwind utility classes + visible focus ring.
 *
 * Second-pass review fixes:
 *   H2 — legacy bare `/pomoc` hrefs in legal pages now interpolate `[locale]`.
 *   M1 — DOM signal on /pomoc is decoupled from any real voucher. We DELIBERATELY
 *        emit `state=support-review` + `freshness=missing` so Epic 7 has a stable
 *        anti-silent-fallback assertion on this surface (the page is informational;
 *        no real voucher is in scope, so the only honest signal is "no voucher data,
 *        route through support").
 *   M2 — drop `force-static` so `data-market` cannot be baked across env flips.
 *   M3 — remove `logWithdrawalStateEvaluated()` emission; legal-help is a DOM-only
 *        surface in the Epic 7 contract. Log channel is reserved for real flow
 *        surfaces (checkout/confirmation/recovery/voucher-card).
 *   M4 — focus-visible ring uses `--accent` for visible focus on dark CTA.
 *   L1 — article gains `aria-labelledby` linking to h1 for landmark navigation.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalPageLayout } from '@/components/templates/LegalPageLayout';
import { VoucherWithdrawalStateCard } from '@/components/molecules/VoucherWithdrawalStateCard';
import type { WithdrawalStateResult } from '@/types/voucher';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const tWL = await getTranslations('voucher_withdrawal.legal');
  return {
    title: tWL('page_title'),
    description: tWL('page_description'),
    robots: { index: false, follow: false },
  };
}

export default async function PomocPage() {
  const t = await getTranslations('voucher_withdrawal');
  const tWL = await getTranslations('voucher_withdrawal.legal');
  const tLegal = await getTranslations('legal');

  // Review fix M1: the legal-help page has NO voucher in scope, so deriving
  // a state from `getWithdrawalState({})` would always emit a misleading
  // "eligible" or env-dependent "support-review" signal. Instead, hard-code
  // the DOM signal payload to `support-review` + `freshness=missing` so the
  // Epic 7 gate has a stable, intentional anti-silent-fallback landmark on
  // this surface: "if you ever see eligible on /pomoc, the helper is wrong".
  // No log emission on this surface (M3) — Epic 7 log channel is reserved
  // for release-critical flow surfaces.
  const withdrawalResult: WithdrawalStateResult = {
    state: 'support-review',
    market_id: '',
    freshness: 'missing',
    action_blocked: true,
  };

  const states = [
    {
      key: 'state_withdrawal_eligible_before_service_execution',
      token: 'withdrawal-eligible-before-service-execution',
    },
    {
      key: 'state_consent_to_execute_captured',
      token: 'consent-to-execute-captured',
    },
    {
      key: 'state_withdrawal_blocked_after_execution',
      token: 'withdrawal-blocked-after-execution',
    },
    {
      key: 'state_refunded',
      token: 'refunded',
    },
    {
      key: 'state_support_review',
      token: 'support-review',
    },
  ] as const;

  return (
    <LegalPageLayout>
      <article
        aria-labelledby="pomoc-page-title"
        data-testid="pomoc-content"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {/* Page header */}
        <header style={{ marginBottom: '2.5rem' }}>
          <h1
            id="pomoc-page-title"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 300,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            {tWL('page_title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            {tWL('intro')}
          </p>
        </header>

        {/* Epic 7 DOM signal landmark (review fix H3) */}
        <section
          aria-labelledby="pomoc-state-signal-heading"
          style={{ marginBottom: '2rem' }}
        >
          <h2
            id="pomoc-state-signal-heading"
            className="sr-only"
          >
            {tWL('section_title')}
          </h2>
          <VoucherWithdrawalStateCard withdrawalResult={withdrawalResult} />
        </section>

        {/* Section 1: Right of withdrawal */}
        <section
          aria-labelledby="prawo-odstapienia-heading"
          data-testid="withdrawal-legal-section"
          style={{ marginBottom: '2.5rem' }}
        >
          <h2
            id="prawo-odstapienia-heading"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(1.25rem, 2vw, 2rem)',
              fontWeight: 400,
              color: 'var(--text-primary)',
              marginBottom: '1rem',
            }}
          >
            {tWL('section_title')}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 14-day window */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {tWL('window_title')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {tWL('window_body')}
              </p>
            </div>

            {/* Consent to execute */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {tWL('consent_title')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {tWL('consent_body')}
              </p>
            </div>

            {/* Post execution */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {tWL('post_execution_title')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {tWL('post_execution_body')}
              </p>
            </div>

            {/* Refunds */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {tWL('refund_title')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {tWL('refund_body')}
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Five FR64 states */}
        <section
          aria-labelledby="stany-vouchera-heading"
          data-testid="withdrawal-states-section"
          style={{ marginBottom: '2.5rem' }}
        >
          <h2
            id="stany-vouchera-heading"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(1.25rem, 2vw, 2rem)',
              fontWeight: 400,
              color: 'var(--text-primary)',
              marginBottom: '0.75rem',
            }}
          >
            {tWL('five_states_title')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
            {tWL('five_states_intro')}
          </p>

          <div
            role="list"
            aria-label={tWL('five_states_title')}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            {states.map(({ key, token }) => (
              <div
                key={token}
                role="listitem"
                className="bb-section-shell rounded px-4 py-3"
                style={{
                  borderColor: 'var(--bb-border-soft)',
                  background: 'var(--bb-surface)',
                }}
                data-testid={`withdrawal-state-entry-${token}`}
              >
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {t(`${key}.label`)}
                </p>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {t(`${key}.description`)}
                </p>
                <code
                  style={{
                    display: 'inline-block',
                    marginTop: '0.35rem',
                    fontSize: '0.75rem',
                    padding: '0.1rem 0.4rem',
                    background: 'var(--bb-surface-muted)',
                    borderRadius: '3px',
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  {token}
                </code>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Support review */}
        <section
          aria-labelledby="pomoc-weryfikacja-heading"
          data-testid="support-review-section"
          style={{ marginBottom: '2.5rem' }}
        >
          <h2
            id="pomoc-weryfikacja-heading"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(1.25rem, 2vw, 2rem)',
              fontWeight: 400,
              color: 'var(--text-primary)',
              marginBottom: '0.75rem',
            }}
          >
            {tWL('support_title')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
            {tWL('support_body')}
          </p>
          <a
            href={`mailto:${tLegal('contact_email')}`}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-[color:var(--bb-page-bg)]"
            style={{
              background: 'var(--bg-action)',
              color: 'var(--text-on-action)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'Inter, sans-serif',
              textDecoration: 'none',
            }}
            data-testid="pomoc-contact-cta"
          >
            {tWL('contact_support')}
          </a>
        </section>
      </article>
    </LegalPageLayout>
  );
}
