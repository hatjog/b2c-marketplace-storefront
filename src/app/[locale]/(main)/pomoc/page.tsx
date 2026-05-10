/**
 * Story v170-2-9: Help / FAQ page — consumer withdrawal and voucher support.
 *
 * Route: /[locale]/pomoc
 *
 * PL-first naming (consistent with `/regulamin`, `/zasady`, `/polityka-prywatnosci`).
 * Covers: how withdrawal works, consent-to-execute, support-review meaning, support contact.
 *
 * SEO: robots noindex/nofollow — pre-prod posture per story constraint.
 * Rendering: force-static (i18n only, no per-market dynamic config needed).
 *
 * IMPORTANT: This page covers consumer-purchase withdrawal (FR64) ONLY.
 * RODO Art. 7/17 recipient-PII consent is handled elsewhere.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalPageLayout } from '@/components/templates/LegalPageLayout';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Pomoc — Voucher BonBeauty',
    description: 'Informacje o prawie odstąpienia od umowy, realizacji voucherów i kontakcie z obsługą BonBeauty.',
    robots: { index: false, follow: false },
  };
}

export default async function PomocPage() {
  const t = await getTranslations('voucher_withdrawal');
  const tLegal = await getTranslations('legal');

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
        data-testid="pomoc-content"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {/* Page header */}
        <header style={{ marginBottom: '2.5rem' }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 300,
              color: 'var(--bb-text-primary, #1A1A1A)',
              marginBottom: '0.5rem',
            }}
          >
            Pomoc — voucher BonBeauty
          </h1>
          <p style={{ color: 'var(--bb-text-secondary, #7A7672)', fontSize: '1rem' }}>
            {t('legal.intro')}
          </p>
        </header>

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
              color: 'var(--bb-text-primary, #1A1A1A)',
              marginBottom: '1rem',
            }}
          >
            {t('legal.section_title')}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 14-day window */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: 'var(--bb-text-primary, #1A1A1A)',
                  marginBottom: '0.5rem',
                }}
              >
                {t('legal.window_title')}
              </h3>
              <p style={{ color: 'var(--bb-text-secondary, #7A7672)', lineHeight: 1.6 }}>
                {t('legal.window_body')}
              </p>
            </div>

            {/* Consent to execute */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: 'var(--bb-text-primary, #1A1A1A)',
                  marginBottom: '0.5rem',
                }}
              >
                {t('legal.consent_title')}
              </h3>
              <p style={{ color: 'var(--bb-text-secondary, #7A7672)', lineHeight: 1.6 }}>
                {t('legal.consent_body')}
              </p>
            </div>

            {/* Post execution */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: 'var(--bb-text-primary, #1A1A1A)',
                  marginBottom: '0.5rem',
                }}
              >
                {t('legal.post_execution_title')}
              </h3>
              <p style={{ color: 'var(--bb-text-secondary, #7A7672)', lineHeight: 1.6 }}>
                {t('legal.post_execution_body')}
              </p>
            </div>

            {/* Refunds */}
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: 'var(--bb-text-primary, #1A1A1A)',
                  marginBottom: '0.5rem',
                }}
              >
                {t('legal.refund_title')}
              </h3>
              <p style={{ color: 'var(--bb-text-secondary, #7A7672)', lineHeight: 1.6 }}>
                {t('legal.refund_body')}
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
              color: 'var(--bb-text-primary, #1A1A1A)',
              marginBottom: '0.75rem',
            }}
          >
            {t('legal.five_states_title')}
          </h2>
          <p style={{ color: 'var(--bb-text-secondary, #7A7672)', marginBottom: '1rem', lineHeight: 1.6 }}>
            {t('legal.five_states_intro')}
          </p>

          <div
            role="list"
            aria-label={t('legal.five_states_title')}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            {states.map(({ key, token }) => (
              <div
                key={token}
                role="listitem"
                className="bb-section-shell rounded border border-[color:var(--bb-border,#D9D7D3)] bg-[color:var(--bb-surface-subtle,rgba(255,252,247,0.8))] px-4 py-3"
                data-testid={`withdrawal-state-entry-${token}`}
              >
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--bb-text-primary, #1A1A1A)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {t(`${key}.label`)}
                </p>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.8125rem',
                    color: 'var(--bb-text-secondary, #7A7672)',
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
                    background: 'var(--bb-surface-code, rgba(0,0,0,0.05))',
                    borderRadius: '3px',
                    color: 'var(--bb-text-muted, #9A9692)',
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
              color: 'var(--bb-text-primary, #1A1A1A)',
              marginBottom: '0.75rem',
            }}
          >
            {t('legal.support_title')}
          </h2>
          <p style={{ color: 'var(--bb-text-secondary, #7A7672)', lineHeight: 1.6, marginBottom: '1rem' }}>
            {t('legal.support_body')}
          </p>
          <a
            href={`mailto:${tLegal('contact_email')}`}
            style={{
              display: 'inline-block',
              padding: '0.625rem 1.25rem',
              background: 'var(--bb-cta, #1A1A1A)',
              color: 'var(--bb-cta-text, #FFFFFF)',
              borderRadius: 'var(--bb-radius-sm, 4px)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.9375rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
            data-testid="pomoc-contact-cta"
          >
            {t('legal.contact_support')}
          </a>
        </section>
      </article>
    </LegalPageLayout>
  );
}
