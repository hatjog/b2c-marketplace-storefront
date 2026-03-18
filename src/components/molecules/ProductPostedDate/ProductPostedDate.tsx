import { formatDistanceToNow } from 'date-fns';
import { getTranslations } from 'next-intl/server';

export const ProductPostedDate = async ({ posted }: { posted: string | null }) => {
  const t = await getTranslations('products');
  const postedDate = formatDistanceToNow(new Date(posted || ''), { addSuffix: true });

  return <p className="label-md text-secondary">{t('posted_date')}: {postedDate}</p>;
};
