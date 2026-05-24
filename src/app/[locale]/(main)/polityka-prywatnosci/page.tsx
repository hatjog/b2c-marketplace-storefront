/**
 * Story v190-wf3-legal-docs-recovery: Polityka Prywatności page (Privacy).
 *
 * Replaces the legacy filesystem-only `specs/ops/privacy-policy-draft-v120.md`
 * reader with the F-NEW-A4 fetchLegalDocument chain. Fail-closed branch
 * renders an explicit error surface; the legacy hard-coded fallback is gone.
 *
 * Preserves the FR64 vs RODO cross-link aside (Story v170-2-9 review fix M6).
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
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

const CANONICAL_SLUG = '/polityka-prywatnosci';

function asLocale(value: string): LegalDocumentLocale {
  if (value === 'en' || value === 'ua' || value === 'de') return value;
  return 'pl';
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('title_privacy'),
    description: t('privacy_description'),
    robots: { index: false, follow: false }
  };
}

export default async function PolitykaPrywatnosciPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  const locale = asLocale(localeRaw);
  const marketId = getMarketId();
  const t = await getTranslations('legal');
  const tWL = await getTranslations('voucher_withdrawal.legal');

  let document;
  try {
    document = await fetchLegalDocument(marketId, CANONICAL_SLUG, locale);
  } catch (err) {
    if (err instanceof LegalDocumentNotFoundError) {
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
              {t('title_privacy')}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('coming_soon_description')}
            </p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', fontSize: '0.875rem' }}>
              market=<code>{marketId}</code> · slug=<code>{CANONICAL_SLUG}</code> · locale=
              <code>{locale}</code>
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
      title={t('title_privacy')}
      locale={locale}
      showAgentDisclaimer={false}
    >
      <StorefrontRouteStateSignal
        route="legal-polityka-prywatnosci"
        surface="legal-polityka-prywatnosci"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="legal-privacy"
      />

      {rendered}

      {/* Review fix M6: cross-link aside disambiguating RODO consent vs.
          FR64 consumer-purchase withdrawal. */}
      <aside
        aria-labelledby="privacy-vs-consumer-withdrawal-heading"
        data-testid="privacy-vs-consumer-withdrawal-note"
        style={{
          marginTop: '2.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--bb-border-soft)'
        }}
      >
        <h2
          id="privacy-vs-consumer-withdrawal-heading"
          className="sr-only"
        >
          {tWL('section_title')}
        </h2>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9375rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6
          }}
        >
          {tWL('privacy_cross_link_note')}
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9375rem' }}>
          <Link
            href={`/${locale}/regulamin`}
            style={{
              color: 'var(--text-primary)',
              textDecoration: 'underline',
              marginRight: '1rem'
            }}
            data-testid="privacy-link-regulamin"
          >
            {t('title_regulamin')}
          </Link>
          <Link
            href={`/${locale}/pomoc`}
            style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}
            data-testid="privacy-link-pomoc"
          >
            {tWL('contact_support')}
          </Link>
        </p>
      </aside>
    </LegalDocLayout>
  );
}
