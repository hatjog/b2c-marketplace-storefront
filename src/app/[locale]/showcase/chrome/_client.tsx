'use client';

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

import { useState } from 'react';

import { ModalShell } from '@/components/organisms/ModalShell/ModalShell';
import { SearchOverlay } from '@/components/organisms/SearchOverlay/SearchOverlay';
import { ToastViewport, type Toast } from '@/components/organisms/ToastAlert/ToastAlert';

// Static toast list covering all 4 variants — no IDs from Date.now() to ensure
// deterministic render between SSR and hydration.
const SHOWCASE_TOASTS: Toast[] = [
  {
    id: 'showcase-toast-info',
    variant: 'info',
    message: 'Showcase: informacja (info)',
  },
  {
    id: 'showcase-toast-success',
    variant: 'success',
    message: 'Showcase: operacja zakonczona (success)',
  },
  {
    id: 'showcase-toast-warning',
    variant: 'warning',
    message: 'Showcase: ostrzezenie (warning)',
  },
  {
    id: 'showcase-toast-error',
    variant: 'error',
    message: 'Showcase: blad krytyczny (error)',
  },
];

export function ShowcaseChrome() {
  // All surfaces mounted in open/visible state — never auto-close in showcase.
  const [searchOpen] = useState(true);
  const [modalOpen] = useState(true);

  // No-op handlers: components stay open for deterministic capture.
  const noop = () => {};

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
        aria-label="Showcase: SearchOverlay (w6-09)"
      >
        <SearchOverlay
          open={searchOpen}
          query="showcase"
          results={[
            {
              id: 'showcase-result-1',
              name: 'Produkt showcase A',
              price: '99 zł',
              href: '#showcase',
            },
            {
              id: 'showcase-result-2',
              name: 'Produkt showcase B',
              price: '149 zł',
              href: '#showcase',
            },
          ]}
          isLoading={false}
          locale="pl"
          recentSearches={['showcase', 'przykład']}
          popularProducts={[]}
          suggestions={['showcase suggestion 1', 'showcase suggestion 2']}
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
        aria-label="Showcase: ToastAlert all variants (w6-06)"
        style={{ position: 'relative', zIndex: 1, minHeight: '300px' }}
      >
        <ToastViewport
          toasts={SHOWCASE_TOASTS}
          placement="top-right"
          onDismiss={noop}
        />
      </section>

      {/* === Section: w6-05-modal-patterns === */}
      <section
        id="section-modal-patterns"
        data-testid="showcase-section-modal-patterns"
        aria-label="Showcase: ModalShell (w6-05)"
        style={{ position: 'relative', minHeight: '400px' }}
      >
        <ModalShell
          open={modalOpen}
          variant="detailed-info"
          title="Showcase: ModalShell — detailed-info (w6-05)"
          body={
            <p>
              Treść showcase dla golden baseline. Komponent ModalShell w stanie open,
              bez triggerów interaktywnych, deterministyczny snapshot.
            </p>
          }
          actions={[
            {
              id: 'showcase-action-primary',
              label: 'Potwierdź',
              onClick: noop,
              variant: 'filled',
            },
            {
              id: 'showcase-action-secondary',
              label: 'Anuluj',
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
