import Link from 'next/link';

import { getTranslations } from 'next-intl/server';

export interface SellersPaginationProps {
  locale: string;
  total: number;
  limit: number;
  offset: number;
  /** Other search params to preserve in pagination links (q, city, sort). */
  preservedParams: Record<string, string>;
}

/**
 * Story v160-4-1: server-rendered pagination for `/[locale]/sellers`.
 *
 * URL state via Next.js `<Link>` — preserves `q`, `city`, `sort` plus
 * adjusted `offset`. No client state; works without JS. AC4 binary gate.
 */
export async function SellersPagination({
  locale,
  total,
  limit,
  offset,
  preservedParams
}: SellersPaginationProps) {
  // QD-03 (CAP-3): jawne locale — komponent i tak dostaje je w propsach
  // i używa w `href`; tłumaczenia muszą iść z tego samego źródła.
  const t = await getTranslations({ locale, namespace: 'seller.search' });
  const tList = await getTranslations({ locale, namespace: 'seller.list' });

  if (total <= limit) {
    return (
      <nav
        className="mt-8 flex items-center justify-between text-sm text-gray-500"
        data-testid="sellers-list-pagination"
        aria-label={tList('next_page')}
      >
        <span data-testid="sellers-list-counter">
          {total > 0 ? `${offset + 1}–${Math.min(offset + limit, total)} / ${total}` : `0 / 0`}
        </span>
      </nav>
    );
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  const buildHref = (targetOffset: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(preservedParams)) {
      if (value) params.set(key, value);
    }
    if (targetOffset > 0) params.set('offset', String(targetOffset));
    params.set('limit', String(limit));
    const qs = params.toString();
    return `/${locale}/sellers${qs ? `?${qs}` : ''}`;
  };

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav
      className="mt-8 flex items-center justify-between gap-4 text-sm text-gray-500"
      data-testid="sellers-list-pagination"
      aria-label={t('pagination_aria')}
    >
      <span data-testid="sellers-list-counter">
        {offset + 1}–{Math.min(offset + limit, total)} / {total}
      </span>

      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(prevOffset)}
            className="rounded-[var(--bb-radius-card)] border px-3 py-2 hover:bg-gray-50"
            data-testid="sellers-pagination-prev"
            rel="prev"
          >
            {tList('previous_page')}
          </Link>
        ) : (
          <span
            className="rounded-[var(--bb-radius-card)] border px-3 py-2 opacity-40"
            aria-disabled="true"
            data-testid="sellers-pagination-prev-disabled"
          >
            {tList('previous_page')}
          </span>
        )}

        <span data-testid="sellers-pagination-page-info">
          {currentPage} / {totalPages}
        </span>

        {hasNext ? (
          <Link
            href={buildHref(nextOffset)}
            className="rounded-[var(--bb-radius-card)] border px-3 py-2 hover:bg-gray-50"
            data-testid="sellers-pagination-next"
            rel="next"
          >
            {tList('next_page')}
          </Link>
        ) : (
          <span
            className="rounded-[var(--bb-radius-card)] border px-3 py-2 opacity-40"
            aria-disabled="true"
            data-testid="sellers-pagination-next-disabled"
          >
            {tList('next_page')}
          </span>
        )}
      </div>
    </nav>
  );
}
