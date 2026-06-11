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
const NAV_ITEMS = [
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

  return (
    <nav className={cn('flex items-center gap-6', className)} data-testid="site-nav" aria-label="BonBeauty">
      {NAV_ITEMS.map(({ key, href }) => {
        const isActive = path === href || path.startsWith(`${href}/`);
        return (
          <LocalizedClientLink
            key={key}
            href={href}
            data-testid={`site-nav-${key}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap text-sm transition-colors',
              isActive
                ? 'font-semibold text-[var(--text-primary)]'
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
