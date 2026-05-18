import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LoadingStatesCatalogue } from '@/components/templates/LoadingStatesCatalogue';
import { LOADING_STATE_IDS } from '@/lib/wave5/catalogues';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('wave5_loading_states');
  return {
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
  };
}

export default async function LoadingStatesPage() {
  const t = await getTranslations('wave5_loading_states');

  return (
    <LoadingStatesCatalogue
      title={t('title')}
      description={t('description')}
      patterns={LOADING_STATE_IDS.map((code) => ({
        code,
        title: t(`patterns.${code}.title`),
        body: t(`patterns.${code}.body`),
      }))}
    />
  );
}
