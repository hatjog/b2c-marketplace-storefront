'use client';

// @chrome-manifest: W6-09
// SearchOverlay — Wave 6 chrome W6-09. v1.8.0 BonBeauty DS search overlay.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/search-overlay.yaml
// CSS custom properties consumed: --bb-surface, --bb-surface-strong, --bb-shadow-soft,
//   --bb-shadow-lift, --bb-border-soft, --bb-border-hairline, --bg-action, --text-primary,
//   --text-secondary, --cta, --bb-radius-card, --bb-radius-pill, --font-body,
//   --font-display, --font-weight-regular, --font-weight-medium, --space-2, --space-4,
//   --space-6, --space-8, --anim-duration-fast, --anim-duration-base, --anim-ease-standard
// Exposed: --search-overlay-z (150), --search-overlay-max-width (1200px)
//
// 3 breakpoint variants (Story 3.1 AC6): desktop (3-col) / tablet (2-col) / mobile (1-col)
// Sekcje: recent searches + suggestions + popular products
// a11y: focus trap + autofocus input + ESC close + combobox/listbox pattern

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

export interface SearchResult {
  id: string;
  name: string;
  imageUrl?: string;
  price?: string;
  href: string;
}

export interface SearchOverlayProps {
  open: boolean;
  query: string;
  results: SearchResult[];
  isLoading?: boolean;
  locale: string;
  recentSearches?: string[];
  popularProducts?: SearchResult[];
  suggestions?: string[];
  onClose: () => void;
  onQueryChange: (q: string) => void;
  onResultSelect: (result: SearchResult) => void;
  className?: string;
}

export function SearchOverlay({
  open,
  query,
  results,
  isLoading = false,
  locale: _locale,
  recentSearches = [],
  popularProducts = [],
  suggestions = [],
  onClose,
  onQueryChange,
  onResultSelect,
  className,
}: SearchOverlayProps) {
  const t = useTranslations('search_overlay');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: onClose,
    lockScroll: true,
  });

  useEffect(() => {
    if (open) {
      // Autofocus search input on open (W6-09 a11y contract)
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  const showEmptyResults = hasQuery && !isLoading && results.length === 0;

  return (
    <div
      ref={containerRef}
      role="search"
      aria-label={t('aria_label')}
      tabIndex={-1}
      data-testid="search-overlay"
      data-variant="responsive"
      className={cn(
        'fixed inset-0 z-[var(--search-overlay-z,150)] flex flex-col',
        'bg-[var(--bb-surface)] motion-safe:animate-[fade-in_var(--anim-duration-fast,150ms)_var(--anim-ease-standard,ease-out)]',
        className
      )}
      style={
        {
          '--search-overlay-z': '150',
          '--search-overlay-max-width': '1200px',
        } as React.CSSProperties
      }
    >
      {/* slot: search-input */}
      <div className="border-b border-[var(--bb-border-soft)] p-[var(--space-4,16px)]">
        <div className="mx-auto flex w-full max-w-[var(--search-overlay-max-width,1200px)] items-center gap-3">
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="search-overlay-suggestions"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('placeholder')}
            className="flex-1 rounded-[var(--bb-radius-pill,9999px)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-[var(--space-4,16px)] py-3 text-base text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)]"
            data-testid="search-overlay-input"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="shrink-0 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            data-testid="search-overlay-close"
          >
            {t('close')}
          </button>
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-[var(--search-overlay-max-width,1200px)] flex-1 overflow-y-auto p-[var(--space-6,24px)]"
        aria-live="polite"
      >
        {!hasQuery && (
          <div className="space-y-[var(--space-8,32px)]">
            {/* slot: recent-searches */}
            {recentSearches.length > 0 && (
              <section data-testid="search-overlay-recent">
                <h2 className="mb-3 text-sm font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                  {t('recent_searches')}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <li key={term}>
                      <button
                        type="button"
                        onClick={() => onQueryChange(term)}
                        className="rounded-[var(--bb-radius-pill,9999px)] border border-[var(--bb-border-soft)] px-3 py-1 text-sm text-[var(--text-primary)] hover:bg-[var(--bb-surface-strong)]"
                      >
                        {term}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* slot: trending / popular products (empty query fallback) */}
            {popularProducts.length > 0 && (
              <section data-testid="search-overlay-popular">
                <h2 className="mb-3 text-sm font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                  {t('popular_products')}
                </h2>
                <ResultsGrid
                  results={popularProducts}
                  onSelect={onResultSelect}
                />
              </section>
            )}
          </div>
        )}

        {hasQuery && (
          <div className="space-y-[var(--space-6,24px)]">
            {/* slot: suggestions */}
            {suggestions.length > 0 && (
              <ul
                id="search-overlay-suggestions"
                role="listbox"
                aria-label={t('suggestions')}
                className="space-y-1"
                data-testid="search-overlay-suggestions"
              >
                {suggestions.map((s) => (
                  <li key={s} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => onQueryChange(s)}
                      className="w-full rounded-[var(--bb-radius-card,12px)] px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bb-surface-strong)]"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* slot: results-grid */}
            {isLoading && (
              <p
                className="text-sm text-[var(--text-secondary)]"
                data-testid="search-overlay-loading"
              >
                {t('loading')}
              </p>
            )}
            {showEmptyResults ? (
              <p
                className="text-sm text-[var(--text-secondary)]"
                data-testid="search-overlay-empty"
              >
                {t('no_results')}
              </p>
            ) : (
              !isLoading && (
                <ResultsGrid results={results} onSelect={onResultSelect} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsGrid({
  results,
  onSelect,
}: {
  results: SearchResult[];
  onSelect: (r: SearchResult) => void;
}) {
  return (
    <div
      // 3 breakpoint variants: mobile 1-col / tablet 2-col / desktop 3-col
      className="grid grid-cols-1 gap-[var(--space-4,16px)] md:grid-cols-2 lg:grid-cols-3"
      data-testid="search-overlay-results"
    >
      {results.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onSelect(r)}
          className="flex gap-3 rounded-[var(--bb-radius-card,12px)] border border-[var(--bb-border-soft)] p-3 text-left hover:shadow-[var(--bb-shadow-soft)]"
          data-testid={`search-result-${r.id}`}
        >
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--bb-radius-card,12px)] bg-[var(--bb-surface-strong)]">
            {r.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.imageUrl}
                alt={r.name}
                className="h-full w-full object-cover"
                width={56}
                height={56}
              />
            )}
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">
              {r.name}
            </span>
            {r.price && (
              <span className="text-xs text-[var(--text-secondary)]">
                {r.price}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
