import Link from 'next/link';

import { STOREFRONT_BASE_URL } from '@/lib/env';

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const baseUrl = STOREFRONT_BASE_URL;
  const lastIndex = items.length - 1;
  const hasMiddleItems = items.length > 2;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(baseUrl ? { item: `${baseUrl}${item.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === lastIndex;
          const isMiddle = !isFirst && !isLast;

          return (
            <li
              key={`${index}-${item.href}`}
              className={
                isMiddle
                  ? 'hidden sm:inline-flex items-center gap-1'
                  : 'inline-flex items-center gap-1'
              }
            >
              {!isFirst && (
                <span className="mx-1 text-secondary" aria-hidden="true">
                  {'>'}
                </span>
              )}
              {isLast ? (
                <span className="font-semibold text-cta" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="text-secondary hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile ellipsis — inserted via CSS order to appear between first and last */}
      {hasMiddleItems && (
        <ol className="flex sm:hidden items-center gap-1 text-sm" aria-hidden="true">
          <li className="inline-flex items-center gap-1">
            <Link href={items[0].href} className="text-secondary hover:underline">
              {items[0].label}
            </Link>
          </li>
          <li className="inline-flex items-center gap-1">
            <span className="mx-1 text-secondary" aria-hidden="true">{'>'}</span>
            <span>{'…'}</span>
          </li>
          <li className="inline-flex items-center gap-1">
            <span className="mx-1 text-secondary" aria-hidden="true">{'>'}</span>
            <span className="font-semibold text-cta" aria-current="page">
              {items[lastIndex].label}
            </span>
          </li>
        </ol>
      )}

      {/* Desktop: show full ol, Mobile: show ellipsis ol */}
      <style>{`
        nav[aria-label="Breadcrumb"] > ol:first-of-type { display: flex; }
        @media (max-width: 639px) {
          nav[aria-label="Breadcrumb"] > ol:first-of-type { display: none; }
        }
        nav[aria-label="Breadcrumb"] > ol:nth-of-type(2) { display: none; }
        @media (max-width: 639px) {
          nav[aria-label="Breadcrumb"] > ol:nth-of-type(2) { display: flex; }
        }
      `}</style>

      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </nav>
  );
}
