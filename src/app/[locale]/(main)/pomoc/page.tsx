import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { HelpCenter } from '@/components/templates/HelpCenter';
import { HELP_TOPIC_IDS } from '@/lib/wave5/catalogues';

const SOURCE_MARKER = 'static-preprod-fallback:help-center-payload-not-yet-available';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('wave5_help');
  return {
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
  };
}

export default async function PomocPage() {
  const t = await getTranslations('wave5_help');

  return (
    <HelpCenter
      eyebrow={t('eyebrow')}
      title={t('title')}
      description={t('description')}
      searchLabel={t('search_label')}
      searchPlaceholder={t('search_placeholder')}
      noResultsLabel={t('no_results')}
      topicsTitle={t('topics_title')}
      trustCardTitle={t('contact_card_title')}
      trustCardBody={t('contact_card_body')}
      trustCardPrimaryLabel={t('contact_card_primary')}
      trustCardPrimaryHref="/pomoc?contact=async"
      trustCardSecondaryLabel={t('contact_card_secondary')}
      trustCardSecondaryHref="/regulamin"
      relatedLinksTitle={t('related_links_title')}
      relatedLinks={[
        { id: 'terms', label: t('related_links.terms'), href: '/regulamin' },
        { id: 'privacy', label: t('related_links.privacy'), href: '/polityka-prywatnosci' },
        { id: 'rules', label: t('related_links.rules'), href: '/zasady' },
        { id: 'status', label: t('related_links.status'), href: 'https://status.bonbeauty.pl' },
      ]}
      topics={HELP_TOPIC_IDS.map((topicId) => ({
        id: topicId,
        title: t(`topics.${topicId}.title`),
        description: t(`topics.${topicId}.description`),
        entries: [1, 2].map((index) => ({
          id: `${topicId}-${index}`,
          question: t(`topics.${topicId}.entries.${index}.question`),
          answer: t(`topics.${topicId}.entries.${index}.answer`),
        })),
      }))}
      sourceMarker={SOURCE_MARKER}
    />
  );
}
