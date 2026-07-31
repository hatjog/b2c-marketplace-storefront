'use client';

// @chrome-manifest: W6-09
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SearchOverlay, type SearchResult } from '@/components/organisms/SearchOverlay/SearchOverlay';

/**
 * Header search trigger (W6-01 contract-A parity, v1.12.0 chrome).
 * Renders the "Szukaj" icon button per the BB-v1.8.0 mockup (replacing the
 * inline search bar) and opens the full-screen SearchOverlay. Free-text submit
 * (Enter) navigates to the category search page — the same target the legacy
 * NavbarSearch used. NOTE: live type-ahead results are a follow-up; the overlay
 * currently opens with an empty result set and relies on free-text submit.
 */
export function HeaderSearch({ locale }: { locale: string }) {
  const t = useTranslations('header.nav');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const goToSearch = (q: string) => {
    const trimmed = q.trim();
    setOpen(false);
    router.push(
      trimmed
        ? `/${locale}/categories?query=${encodeURIComponent(trimmed)}`
        : `/${locale}/categories`
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('search')}
        data-testid="header-search-button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      <SearchOverlay
        open={open}
        query={query}
        results={[] as SearchResult[]}
        locale={locale}
        onClose={() => setOpen(false)}
        onQueryChange={setQuery}
        onResultSelect={(result) => {
          setOpen(false);
          router.push(result.href);
        }}
        onSubmit={goToSearch}
      />
    </>
  );
}
