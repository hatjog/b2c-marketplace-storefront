import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { getLocale, getTranslations } from 'next-intl/server';

const dateFnsLocales: Record<string, Locale> = { pl };

export const ProductPostedDate = async ({ posted }: { posted: string | null }) => {
  if (!posted) return null;

  const t = await getTranslations('products');
  const activeLocale = await getLocale();
  const postedDate = formatDistanceToNow(new Date(posted), {
    addSuffix: true,
    locale: dateFnsLocales[activeLocale]
  });

  return <p className="label-md text-secondary">{t('posted_date')}: {postedDate}</p>;
};
