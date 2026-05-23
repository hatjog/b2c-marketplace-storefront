import Link from 'next/link';

import plMessages from '../../messages/pl.json';

import { ErrorSurface } from '@/components/templates/ErrorSurface';

export const metadata = {
  title: plMessages.wave5_errors.not_found.meta_title,
  description: plMessages.wave5_errors.not_found.meta_description,
};

export default function NotFound() {
  const t = plMessages.wave5_errors.not_found;

  return (
    <ErrorSurface
      data-testid="root-not-found"
      eyebrow={t.generic.eyebrow}
      title={t.title}
      description={t.generic.body}
      tone="neutral"
      primaryAction={
        <Link
          href="/pl"
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-3 text-sm font-medium text-action-on-primary no-underline"
        >
          {t.primary_cta}
        </Link>
      }
      secondaryAction={
        <Link
          href="/pl/categories"
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-[rgba(113,88,40,0.16)] px-5 py-3 text-sm font-medium text-primary no-underline"
        >
          {t.secondary_cta}
        </Link>
      }
    />
  );
}
