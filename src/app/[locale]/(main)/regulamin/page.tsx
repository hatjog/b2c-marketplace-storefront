/**
 * Story v190-wf3-legal-docs-recovery: Regulamin page (Terms of Service).
 *
 * Uses fetchLegalDocument (storefront-side legal-docs chain — F-NEW-A4 /
 * Story 7-4 LegalDocLayout T3 recovery) to load the published markdown
 * master.{md,en.md,uk.md,de.md} from gp-ops/markets/<market>/legal/portal/regulamin/.
 *
 * Fail-closed: when the document is missing, renders an explicit error
 * surface (NOT a silent placeholder). This satisfies validate_legal_signals
 * Signal 4.
 *
 * Preserves the FR64 consumer-withdrawal cross-link section (Story v170-2-9).
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { LegalDocLayout } from '@/components/templates/LegalDocLayout';
import {
  LegalDocumentNotFoundError,
  fetchLegalDocument,
  type LegalDocumentLocale
} from '@/lib/legal/fetchLegalDocument';
import { getMarketId } from '@/lib/helpers/market-filter';
import { renderLegalMarkdown } from '@/lib/legal/renderLegalMarkdown';

export const dynamic = 'force-dynamic';

const CANONICAL_SLUG = '/regulamin';

function asLocale(value: string): LegalDocumentLocale {
  if (value === 'en' || value === 'ua' || value === 'de') return value;
  return 'pl';
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('title_regulamin'),
    description: t('regulamin_description'),
    robots: { index: false, follow: false }
  };
}

export default async function RegulaminPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  setRequestLocale(localeRaw);
  const locale = asLocale(localeRaw);
  const marketId = getMarketId();
  const t = await getTranslations('legal');
  const tW = await getTranslations('voucher_withdrawal');

  let document;
  try {
    document = await fetchLegalDocument(marketId, CANONICAL_SLUG, locale);
  } catch (err) {
    if (err instanceof LegalDocumentNotFoundError) {
      // Signal 4 — fail-closed explicit error branch (NO silent fallback)
      return (
        <main
          className="min-h-screen"
          style={{ background: 'var(--bb-page-bg, #F3F1ED)' }}
          data-testid="legal-doc-not-found"
          data-legal-fail-closed-render="true"
        >
          <div className="bb-page-shell mx-auto max-w-[800px] py-12">
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                fontWeight: 300,
                color: 'var(--text-primary)'
              }}
            >
              {t('title_regulamin')}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('coming_soon_description')}
            </p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', fontSize: '0.875rem' }}>
              {t('debug_market_label')}<code>{marketId}</code>{t('debug_slug_label')}<code>{CANONICAL_SLUG}</code>{t('debug_locale_label')}
              <code>{locale}</code> ·{' '}
              <a
                href={`mailto:${t('contact_email')}`}
                style={{ textDecoration: 'underline' }}
              >
                {t('contact_email')}
              </a>
            </p>
          </div>
        </main>
      );
    }
    throw err;
  }

  const rendered = renderLegalMarkdown(document.body);

  return (
    <LegalDocLayout
      document={document}
      title={t('title_regulamin')}
      locale={locale}
      showAgentDisclaimer
    >
      <StorefrontRouteStateSignal
        route="legal-regulamin"
        surface="legal-regulamin"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="legal-regulamin"
      />

      {rendered}

      {/* FR64 consumer withdrawal cross-link (preserved from v170-2-9) */}
      <section
        aria-labelledby="regulamin-withdrawal-heading"
        data-testid="regulamin-withdrawal-section"
        style={{
          marginTop: '2.5rem',
          borderTop: '1px solid var(--bb-border-soft)',
          paddingTop: '2rem'
        }}
      >
        <h2
          id="regulamin-withdrawal-heading"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.25rem, 2vw, 2rem)',
            fontWeight: 400,
            color: 'var(--text-primary)',
            marginBottom: '1rem'
          }}
        >
          {tW('legal.section_title')}
        </h2>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          {tW('legal.intro')}
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          {tW('legal.window_body')}
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          {tW('legal.consent_body')}
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {tW('legal.refund_body')}
        </p>

        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}
        >
          {tW('legal.five_states_intro')}
        </p>
        <ul
          aria-label={tW('legal.five_states_title')}
          style={{
            paddingLeft: '1.5rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}
        >
          <li data-testid="withdrawal-state-entry-withdrawal-eligible-before-service-execution">
            {tW('legal.state_list.eligible')}
          </li>
          <li data-testid="withdrawal-state-entry-consent-to-execute-captured">
            {tW('legal.state_list.consent')}
          </li>
          <li data-testid="withdrawal-state-entry-withdrawal-blocked-after-execution">
            {tW('legal.state_list.blocked')}
          </li>
          <li data-testid="withdrawal-state-entry-refunded">{tW('legal.state_list.refunded')}</li>
          <li data-testid="withdrawal-state-entry-support-review">
            {tW('legal.state_list.support')}
          </li>
        </ul>

        <Link
          href={`/${locale}/pomoc`}
          style={{
            display: 'inline-block',
            color: 'var(--text-primary)',
            textDecoration: 'underline',
            fontSize: '0.9375rem'
          }}
          data-testid="regulamin-pomoc-link"
        >
          {tW('legal.contact_support')} →
        </Link>
      </section>
    </LegalDocLayout>
  );
}
