import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export type SellersView = 'list' | 'map';

export interface SellersViewToggleProps {
  locale: string;
  view: SellersView;
  /**
   * Already-validated query params from the parent page (q, city, sort,
   * limit, offset, etc.). Toggle preserves them on every flip — only `view`
   * is rewritten.
   */
  preservedParams?: Record<string, string>;
}

/**
 * Story v160-4-2 — server-rendered list/map view toggle dla `/[locale]/sellers`.
 *
 * Pure native `<Link>` items — zero client JS, works without hydration (NFR-A11Y),
 * preserves existing search/filter/sort state on flip. Active item gets
 * `aria-current="page"` for screen-reader parity.
 */
export async function SellersViewToggle({
  locale,
  view,
  preservedParams = {}
}: SellersViewToggleProps) {
  // QD-03 (CAP-3): jawne locale — to samo, które buduje `href` toggle'a.
  const t = await getTranslations({ locale, namespace: 'seller.list.map' });

  function buildHref(target: SellersView): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(preservedParams)) {
      if (key === 'view') continue;
      if (value !== '' && value != null) params.set(key, value);
    }
    if (target === 'map') {
      params.set('view', 'map');
    }
    const qs = params.toString();
    return `/${locale}/sellers${qs ? `?${qs}` : ''}`;
  }

  const baseClass =
    'inline-flex items-center justify-center rounded-[var(--bb-radius-card)] border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary';
  const activeClass = 'border-primary bg-primary text-white';
  const inactiveClass =
    'border-[var(--bb-border-strong)] bg-[var(--bb-surface)] text-[var(--text-secondary)] hover:bg-[var(--bb-surface-muted)]';

  return (
    <div
      role="tablist"
      aria-label={t('view_toggle_aria') ?? 'Widok listy lub mapy'}
      className="mb-6 inline-flex gap-2"
      data-testid="sellers-view-toggle"
    >
      <Link
        role="tab"
        href={buildHref('list')}
        aria-current={view === 'list' ? 'page' : undefined}
        aria-selected={view === 'list'}
        className={`${baseClass} ${view === 'list' ? activeClass : inactiveClass}`}
        data-testid="sellers-view-toggle-list"
      >
        {t('view_toggle_list')}
      </Link>
      <Link
        role="tab"
        href={buildHref('map')}
        aria-current={view === 'map' ? 'page' : undefined}
        aria-selected={view === 'map'}
        className={`${baseClass} ${view === 'map' ? activeClass : inactiveClass}`}
        data-testid="sellers-view-toggle-map"
      >
        {t('view_toggle_map')}
      </Link>
    </div>
  );
}

export default SellersViewToggle;
