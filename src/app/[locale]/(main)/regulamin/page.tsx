import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalPageLayout } from '@/components/templates/LegalPageLayout';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Regulamin | BonBeauty',
    description: 'Regulamin BonBeauty — strona w przygotowaniu.',
    robots: { index: false, follow: false }
  };
}

export default async function RegulaminPage() {
  const t = await getTranslations('legal');

  return (
    <LegalPageLayout>
      <article data-testid="regulamin-content">
        <header style={{ marginBottom: '2.5rem' }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 300,
              color: '#1A1A1A',
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
            color: '#1A1A1A'
          }}
        >
          <p
            style={{
              fontSize: '1.125rem',
              fontWeight: 500,
              marginBottom: '1rem',
              color: '#1A1A1A'
            }}
          >
            {t('coming_soon')}
          </p>

          <p style={{ color: '#7A7672', marginBottom: '1.5rem' }}>
            {t('coming_soon_description')}
          </p>

          <p style={{ color: '#7A7672' }}>
            <a
              href={`mailto:${t('contact_email')}`}
              style={{ color: '#1A1A1A', textDecoration: 'underline' }}
            >
              {t('contact_email')}
            </a>
          </p>
        </div>
      </article>
    </LegalPageLayout>
  );
}
