import { getTranslations } from 'next-intl/server';

import LocalizedLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export const TrustMessaging = async () => {
  const t = await getTranslations('products');

  const cards = [
    {
      title: t('trust_curation'),
      description: t('trust_curation_desc')
    },
    {
      title: t('trust_policy'),
      description: t('trust_policy_desc'),
      // TODO: Change to /regulamin when Story 2.8 delivers legal pages
      link: '/polityka-prywatnosci',
      linkText: t('trust_policy_link')
    },
    {
      title: t('trust_validity'),
      description: t('trust_validity_desc')
    }
  ];

  return (
    <div className="my-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      {cards.map(card => (
        <div
          key={card.title}
          className="rounded-[3px] bg-secondary p-4 text-primary"
        >
          <h4 className="label-md mb-1 font-semibold">{card.title}</h4>
          <p className="label-sm text-secondary">{card.description}</p>
          {card.link && (
            <LocalizedLink
              href={card.link}
              className="label-sm mt-2 inline-block text-accent underline"
            >
              {card.linkText}
            </LocalizedLink>
          )}
        </div>
      ))}
    </div>
  );
};
