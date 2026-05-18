import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { EmptyStatesCatalogue } from '@/components/templates/EmptyStatesCatalogue';
import { EMPTY_STATE_PATTERN_IDS } from '@/lib/wave5/catalogues';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('wave5_empty_states');
  return {
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
  };
}

export default async function EmptyStatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('wave5_empty_states');

  return (
    <EmptyStatesCatalogue
      locale={locale}
      title={t('title')}
      description={t('description')}
      patterns={EMPTY_STATE_PATTERN_IDS.map((id, index) => {
        const code = `ES${index + 1}`;
        const key = `patterns.${code}`;
        return {
          id,
          code,
          title: t(`${key}.title`),
          body: t(`${key}.body`),
          ctaLabel: t.has(`${key}.cta`) ? t(`${key}.cta`) : undefined,
          ctaHref: t.has(`${key}.cta_href`) ? t(`${key}.cta_href`) : undefined,
          note: t.has(`${key}.note`) ? t(`${key}.note`) : undefined,
        };
      })}
    />
  );
}
