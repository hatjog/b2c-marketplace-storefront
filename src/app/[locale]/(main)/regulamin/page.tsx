/**
 * Story v170-2-9: Regulamin page extended with FR64 consumer withdrawal section.
 *
 * The "Prawo odstąpienia od umowy" section names all five FR64 state tokens
 * verbatim and links to the /pomoc page for detailed FAQ. This satisfies
 * AC2: legal page copy must not contradict checkout/confirmation/recovery states.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { StorefrontI18nLongContentProbe } from '@/components/atoms';
import { LegalPageLayout } from '@/components/templates/LegalPageLayout';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('title_regulamin'),
    description: t('regulamin_description'),
    robots: { index: false, follow: false }
  };
}

export default async function RegulaminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('legal');
  const tW = await getTranslations('voucher_withdrawal');

  return (
    <LegalPageLayout>
      <article data-testid="regulamin-content">
        <StorefrontI18nLongContentProbe
          locale={locale}
          surface="legal-regulamin"
        />
        <header style={{ marginBottom: '2.5rem' }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 300,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}
          >
            {t('title_regulamin')}
          </h1>
        </header>

        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)'
          }}
        >
          <p
            style={{
              fontSize: '1.125rem',
              fontWeight: 500,
              marginBottom: '1rem',
              color: 'var(--text-primary)'
            }}
          >
            {t('coming_soon')}
          </p>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {t('coming_soon_description')}
          </p>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
            <a
              href={`mailto:${t('contact_email')}`}
              style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}
            >
              {t('contact_email')}
            </a>
          </p>
        </div>

        {/* Consumer withdrawal section — FR64 (Story v170-2-9) */}
        <section
          aria-labelledby="regulamin-withdrawal-heading"
          data-testid="regulamin-withdrawal-section"
          style={{ marginTop: '2.5rem', borderTop: '1px solid var(--bb-border-soft)', paddingTop: '2rem' }}
        >
          <h2
            id="regulamin-withdrawal-heading"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(1.25rem, 2vw, 2rem)',
              fontWeight: 400,
              color: 'var(--text-primary)',
              marginBottom: '1rem',
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

          {/* Five FR64 state tokens — verbatim per AC2 */}
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
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
              marginBottom: '1.5rem',
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
            <li data-testid="withdrawal-state-entry-refunded">
              {tW('legal.state_list.refunded')}
            </li>
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
              fontSize: '0.9375rem',
            }}
            data-testid="regulamin-pomoc-link"
          >
            {tW('legal.contact_support')} →
          </Link>
        </section>
      </article>
    </LegalPageLayout>
  );
}
