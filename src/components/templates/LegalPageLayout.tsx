// @legal-signal-scope: v180
/**
 * LegalPageLayout — Story v190-wf3-legal-docs-recovery upgrade.
 *
 * Backwards-compatible wrapper around `LegalDocLayout` for routes that still
 * curate their own JSX (e.g. /pomoc with VoucherWithdrawalStateCard, /zasady
 * with SanitizedHTML sections). When a `document` prop is provided, all 5
 * trust signals (last-updated, version, draft watermark, fail-closed marker,
 * provenance) render via LegalDocLayout. When no document is provided, the
 * legacy 33-line placeholder shape is preserved so unrelated callers don't
 * break.
 *
 * For NEW long-form legal markdown pages prefer LegalDocLayout directly with
 * `renderLegalMarkdown(document.body)` as children.
 */

import type { ReactNode } from 'react';

import { getTranslations } from 'next-intl/server';

import { LegalDocLayout, type LegalDocLayoutProps } from '@/components/templates/LegalDocLayout';
import type { LegalDocument } from '@/lib/legal/fetchLegalDocument';

interface LegalPageLayoutProps {
  children: ReactNode;
  showDisclaimer?: boolean;
  /**
   * Optional pre-fetched legal document. When provided, all 5 trust signals
   * render via LegalDocLayout and `children` becomes the body slot.
   */
  document?: LegalDocument;
  /**
   * QD-03 (CAP-3): locale trasy, WYMAGANE na OBU ścieżkach. Wcześniej było
   * opcjonalne („required when `document` is provided"), a legacy placeholder
   * czytał `getTranslations('legal')` z request store — czyli dokładnie ta
   * granica renderu, na której store bywa pusty.
   */
  locale: LegalDocLayoutProps['locale'];
  /**
   * Optional explicit title override (forwarded to LegalDocLayout).
   */
  title?: string;
}

export async function LegalPageLayout({
  children,
  showDisclaimer = true,
  document,
  locale,
  title
}: LegalPageLayoutProps) {
  if (document) {
    return (
      <LegalDocLayout
        document={document}
        title={title}
        locale={locale}
        showAgentDisclaimer={showDisclaimer}
      >
        {children}
      </LegalDocLayout>
    );
  }

  // Legacy backward-compat path: no document → render placeholder shell with
  // optional agent disclaimer. Used by routes that still render hand-curated
  // JSX (/pomoc with FR64 state card, /zasady with runtime-config sections).
  // QD-03 (CAP-3): jawne locale trasy także na ścieżce legacy.
  const t = await getTranslations({ locale, namespace: 'legal' });
  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--bb-page-bg, #F3F1ED)' }}
    >
      <div className="bb-page-shell mx-auto max-w-[1200px]">
        {showDisclaimer && (
          <div
            className="bb-section-shell mb-2 px-5 py-4"
            style={{
              borderColor: 'var(--bb-border-soft)',
              background: 'var(--bb-surface)'
            }}
            data-testid="legal-agent-disclaimer"
          >
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('agent_disclaimer')}
            </p>
          </div>
        )}

        <div className="bb-section-shell legal-content">{children}</div>
      </div>
    </main>
  );
}
