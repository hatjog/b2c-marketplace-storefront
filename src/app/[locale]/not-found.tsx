import { getLocale, getTranslations } from 'next-intl/server';

import Link from 'next/link';

import { ErrorSurface } from '@/components/templates/ErrorSurface';

export default async function LocaleNotFound() {
  const locale = await getLocale();
  const t = await getTranslations('wave5_errors');

  return (
    <ErrorSurface
      data-testid="generic-not-found"
      eyebrow={t('not_found.generic.eyebrow')}
      title={t('not_found.title')}
      description={t('not_found.generic.body')}
      tone="neutral"
      primaryAction={
        <Link
          href={`/${locale}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-3 text-sm font-medium text-action-on-primary no-underline"
        >
          {t('not_found.primary_cta')}
        </Link>
      }
      secondaryAction={
        <Link
          href={`/${locale}/categories`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-[var(--bb-tint-brown-16)] px-5 py-3 text-sm font-medium text-primary no-underline"
        >
          {t('not_found.secondary_cta')}
        </Link>
      }
    />
  );
}
