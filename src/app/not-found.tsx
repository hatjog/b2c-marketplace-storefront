import { headers } from 'next/headers';
import Link from 'next/link';

import deMessages from '../../messages/de.json';
import enMessages from '../../messages/en.json';
import plMessages from '../../messages/pl.json';
import uaMessages from '../../messages/ua.json';

import { ErrorSurface } from '@/components/templates/ErrorSurface';

/**
 * Root not-found surface — sits OUTSIDE the `[locale]` segment so we have
 * to resolve the visitor's locale defensively from the request URL.
 *
 * v1.9.0 Wave F7 hardening (CC-3 L1): previously hard-coded Polish
 * messages + link to `/pl`, leaving UA/DE/EN visitors with broken locale
 * routing. Now mirrors `global-error.tsx` pathname resolution and uses
 * the matching catalogue + `/${locale}` links.
 */

const CATALOGUES = {
  pl: plMessages,
  en: enMessages,
  ua: uaMessages,
  de: deMessages
} as const;

type Locale = keyof typeof CATALOGUES;

function resolveLocaleFromHeaders(pathname: string | null | undefined): Locale {
  if (!pathname) return 'pl';
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment === 'en' || segment === 'ua' || segment === 'de' ? segment : 'pl';
}

export async function generateMetadata() {
  // Headers are available in metadata generation in async function form.
  const h = await headers();
  const pathname = h.get('x-pathname') ?? h.get('x-invoke-path') ?? null;
  const locale = resolveLocaleFromHeaders(pathname);
  const t = CATALOGUES[locale].wave5_errors.not_found;
  return {
    title: t.meta_title,
    description: t.meta_description
  };
}

export default async function NotFound() {
  const h = await headers();
  const pathname = h.get('x-pathname') ?? h.get('x-invoke-path') ?? null;
  const locale = resolveLocaleFromHeaders(pathname);
  const t = CATALOGUES[locale].wave5_errors.not_found;

  return (
    <ErrorSurface
      data-testid="root-not-found"
      eyebrow={t.generic.eyebrow}
      title={t.title}
      description={t.generic.body}
      tone="neutral"
      primaryAction={
        <Link
          href={`/${locale}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-3 text-sm font-medium text-action-on-primary no-underline"
        >
          {t.primary_cta}
        </Link>
      }
      secondaryAction={
        <Link
          href={`/${locale}/categories`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-[var(--bb-border-soft)] px-5 py-3 text-sm font-medium text-primary no-underline"
        >
          {t.secondary_cta}
        </Link>
      }
    />
  );
}
