'use client';

// @chrome-manifest: W6-05
// @chrome-manifest: W6-06
// @chrome-manifest: W6-09
/**
 * ShowcaseChrome — client component.
 *
 * Mounts Wave-6 chrome components in deterministic, always-open/visible state
 * suitable for golden baseline visual capture (Story 7.11).
 *
 * Rules:
 * - No timers or auto-dismiss (disableAutoDismiss prop passed to ToastViewport wrapper).
 * - Fixed copy (no Date.now() / random / locale-dynamic text that could flake).
 * - Animations disabled via `data-showcase="1"` attribute + CSS in showcase layout.
 * - Components controlled via React.useState initialized to open=true.
 */

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ModalShell } from '@/components/organisms/ModalShell/ModalShell';
import { SearchOverlay } from '@/components/organisms/SearchOverlay/SearchOverlay';
import { ToastViewport, type Toast } from '@/components/organisms/ToastAlert/ToastAlert';

export function ShowcaseChrome() {
  const t = useTranslations('showcase.chrome');
  const locale = useLocale();
  // All surfaces mounted in open/visible state — never auto-close in showcase.
  const [searchOpen] = useState(true);
  const [modalOpen] = useState(true);

  // No-op handlers: components stay open for deterministic capture.
  const noop = () => {};
  const showcaseToasts: Toast[] = [
    {
      id: 'showcase-toast-info',
      variant: 'info',
      message: t('toasts.info'),
    },
    {
      id: 'showcase-toast-success',
      variant: 'success',
      message: t('toasts.success'),
    },
    {
      id: 'showcase-toast-warning',
      variant: 'warning',
      message: t('toasts.warning'),
    },
    {
      id: 'showcase-toast-error',
      variant: 'error',
      message: t('toasts.error'),
    },
  ];

  return (
    <div
      data-testid="showcase-chrome-root"
      data-showcase="1"
      // Disable all CSS animations/transitions in showcase for deterministic snapshots.
      style={{ animation: 'none' }}
    >
      {/*
       * Global override: disable motion/animations on the entire showcase page.
       * Inline style-tag avoids importing a CSS file that could affect prod bundle.
       */}
      <style>{`
        [data-showcase="1"] *,
        [data-showcase="1"] *::before,
        [data-showcase="1"] *::after {
          animation-duration: 0ms !important;
          animation-delay: 0ms !important;
          transition-duration: 0ms !important;
          transition-delay: 0ms !important;
        }
      `}</style>

      {/* === Section: w6-09-search-overlay === */}
      <section
        id="section-search-overlay"
        data-testid="showcase-section-search-overlay"
        aria-label={t('sections.searchOverlay')}
      >
        <SearchOverlay
          open={searchOpen}
          query={t('search.query')}
          results={[
            {
              id: 'showcase-result-1',
              name: t('search.resultA.name'),
              price: t('search.resultA.price'),
              href: '#showcase',
            },
            {
              id: 'showcase-result-2',
              name: t('search.resultB.name'),
              price: t('search.resultB.price'),
              href: '#showcase',
            },
          ]}
          isLoading={false}
          locale={locale}
          recentSearches={[t('search.recentA'), t('search.recentB')]}
          popularProducts={[]}
          suggestions={[t('search.suggestionA'), t('search.suggestionB')]}
          onClose={noop}
          onQueryChange={noop}
          onResultSelect={noop}
        />
      </section>

      {/* === Section: w6-06-toast-alert-system === */}
      {/*
       * ToastViewport is used directly (not ToastProvider) to bypass the auto-dismiss
       * timer queue entirely. Static toast list with fixed IDs — no Date.now().
       * onDismiss is a no-op so toasts never disappear.
       */}
      <section
        id="section-toast-alert"
        data-testid="showcase-section-toast-alert"
        aria-label={t('sections.toastAlert')}
        style={{ position: 'relative', zIndex: 1, minHeight: '300px' }}
      >
        <ToastViewport
          toasts={showcaseToasts}
          placement="top-right"
          onDismiss={noop}
        />
      </section>

      {/* === Section: w6-05-modal-patterns === */}
      <section
        id="section-modal-patterns"
        data-testid="showcase-section-modal-patterns"
        aria-label={t('sections.modalPatterns')}
        style={{ position: 'relative', minHeight: '400px' }}
      >
        <ModalShell
          open={modalOpen}
          variant="detailed-info"
          title={t('modal.title')}
          body={<p>{t('modal.body')}</p>}
          actions={[
            {
              id: 'showcase-action-primary',
              label: t('modal.primary'),
              onClick: noop,
              variant: 'filled',
            },
            {
              id: 'showcase-action-secondary',
              label: t('modal.secondary'),
              onClick: noop,
              variant: 'tonal',
            },
          ]}
          onClose={noop}
        />
      </section>
    </div>
  );
}
