'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { cn } from '@/lib/utils';

/**
 * Primary site navigation (W6-01 contract-A parity, v1.12.0 chrome).
 * Text links per the BB-v1.8.0 site-header mockup — Kategorie · Salony ·
 * Polecane · Blog · Pomoc — replacing the legacy category dropdown in the
 * top bar. Active state is derived from the current path (locale-stripped).
 */
export const NAV_ITEMS = [
  { key: 'categories', href: '/categories' },
  { key: 'salons', href: '/sellers' },
  { key: 'featured', href: '/collections' },
  { key: 'blog', href: '/blog' },
  { key: 'help', href: '/pomoc' },
] as const;

function stripLocale(pathname: string): string {
  // /pl/categories → /categories ; /pl → /
  const seg = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');
  return seg === '' ? '/' : seg;
}

export function SiteNav({ className }: { className?: string }) {
  const t = useTranslations('header.nav');
  const path = stripLocale(usePathname() || '/');

  // BB-v1.8.0 mockup: ONLY the active link is underlined. On routes that match
  // no nav item (e.g. home), the first item (Kategorie) is the initial active.
  const matchedIndex = NAV_ITEMS.findIndex(
    ({ href }) => path === href || path.startsWith(`${href}/`)
  );
  const activeIndex = matchedIndex >= 0 ? matchedIndex : 0;

  return (
    <nav className={cn('flex items-center gap-6', className)} data-testid="site-nav" aria-label="BonBeauty">
      {NAV_ITEMS.map(({ key, href }, index) => {
        const isActive = index === activeIndex;
        return (
          <LocalizedClientLink
            key={key}
            href={href}
            data-testid={`site-nav-${key}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              // Transparent bottom border reserves space (no layout shift); only
              // the active link shows the underline + primary ink.
              'whitespace-nowrap border-b border-transparent pb-0.5 text-sm transition-colors',
              isActive
                ? 'border-[var(--text-primary)] font-semibold text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {t(key)}
          </LocalizedClientLink>
        );
      })}
    </nav>
  );
}
