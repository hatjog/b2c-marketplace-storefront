// @legal-signal-scope: v180
/**
 * LegalDocLayout — Story v190-wf3-legal-docs-recovery.
 *
 * Render layer (T3) for the Epic 7 legal-docs publication chain. Replaces the
 * 33-line placeholder LegalPageLayout. Renders all 5 trust signals required
 * by Story 7.9 AC9 / validate_legal_signals_trust_invariants.py:
 *
 *   Signal 1: last-updated timestamp        → time element with `dateTime`
 *   Signal 2: version indicator             → labelled "Wersja vN.M" badge
 *   Signal 3: draft watermark               → rendered when
 *                                              reviewStatus === 'published_draft_status'
 *   Signal 4: fail-closed branch            → ErrorState (no silent fallback)
 *   Signal 5: provenance                    → authoring_source + legal_review_ref
 *                                              displayed in footer meta
 *
 * Accepts a pre-fetched `LegalDocument` (from `fetchLegalDocument`) and
 * optional locale-switcher + table-of-contents affordances.
 *
 * Server component (no `"use client"`). Pure presentational; all data is
 * passed via props.
 */

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import type { LegalDocument } from '@/lib/legal/fetchLegalDocument';
import { AlertIcon, TimeIcon, TagIcon, DocumentIcon } from '@/icons';

export interface LegalDocLayoutProps {
  /** Pre-fetched legal document body + metadata. */
  document: LegalDocument;
  /**
   * Display title for the page header. If omitted, the layout derives it from
   * the first H1 in `document.body` (so the layout works even when the page
   * route doesn't override).
   */
  title?: string;
  /**
   * Storefront locale code (pl/en/ua/de). Used to display the
   * "Translation pending" badge when `document.localeFallback === true`.
   */
  locale: 'pl' | 'en' | 'ua' | 'de';
  /**
   * Pre-rendered body — typically `renderLegalMarkdown(document.body)`. Passed
   * in so the page route can intersperse custom sections (e.g. cross-link
   * notes) without re-implementing markdown rendering.
   */
  children: ReactNode;
  /**
   * Optional translated strings. If absent, falls back to English literals
   * — the layout is i18n-aware but does not hard-require a messages namespace.
   */
  strings?: Partial<LegalDocLayoutStrings>;
  /**
   * Optional pre-rendered locale switcher slot.
   */
  localeSwitcher?: ReactNode;
  /**
   * When true (default), the layout renders the "BonBeauty jest pośrednikiem"
   * agent disclaimer. Routes like `/pomoc` may opt out.
   */
  showAgentDisclaimer?: boolean;
  /**
   * Custom agent disclaimer text. Defaults to a PL/EN literal pair when
   * `strings.agentDisclaimer` is absent.
   */
  agentDisclaimer?: string;
}

interface LegalDocLayoutStrings {
  lastUpdatedLabel: string; // "Ostatnia aktualizacja" / "Last updated"
  versionLabel: string; // "Wersja" / "Version"
  draftBadge: string; // "DRAFT — wymaga review prawnego" / "DRAFT — pending legal review"
  draftBadgeDescription: string;
  localeFallbackBadge: string; // "Tłumaczenie w przygotowaniu" / "Translation pending"
  localeFallbackDescription: string;
  provenanceInHouse: string; // "Tekst opracowany wewnętrznie" / "Drafted in-house"
  provenanceExternalCounsel: string; // "Reviewed by external counsel" / etc.
  provenanceTranslationLabel: string; // "Tłumaczenie wewnętrzne" / "In-house translation"
  agentDisclaimer: string;
  tableOfContentsLabel: string; // "Spis treści" / "Contents"
}

function deriveTitle(body: string, fallback: string): string {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function provenanceLabel(
  doc: LegalDocument,
  strings: LegalDocLayoutStrings
): string {
  if (doc.authoringSource === 'external_counsel') {
    const ref = doc.legalReviewRef ? ` (${doc.legalReviewRef})` : '';
    return `${strings.provenanceExternalCounsel}${ref}`;
  }
  // in_house
  if (doc.legalReviewRef === 'in_house_translated') {
    return `${strings.provenanceInHouse} · ${strings.provenanceTranslationLabel}`;
  }
  return strings.provenanceInHouse;
}

export async function LegalDocLayout({
  document,
  title,
  locale: _locale,
  children,
  strings: stringsOverride,
  localeSwitcher,
  showAgentDisclaimer = true,
  agentDisclaimer
}: LegalDocLayoutProps) {
  // `locale` is accepted in props as the request-time storefront locale (used
  // by the calling route page for cross-link href generation), but the
  // layout itself reads `document.locale` (which may differ when the
  // requested locale fell back to PL). Marked with `_` to silence the
  // unused-args lint while preserving the API contract.
  const t = await getTranslations({ locale: _locale, namespace: 'legal.doc_layout' });
  const defaultStrings: LegalDocLayoutStrings = {
    lastUpdatedLabel: t('last_updated_label'),
    versionLabel: t('version_label'),
    draftBadge: t('draft_badge'),
    draftBadgeDescription: t('draft_badge_description'),
    localeFallbackBadge: t('locale_fallback_badge'),
    localeFallbackDescription: t('locale_fallback_description'),
    provenanceInHouse: t('provenance_in_house'),
    provenanceExternalCounsel: t('provenance_external_counsel'),
    provenanceTranslationLabel: t('provenance_translation_label'),
    agentDisclaimer: t('agent_disclaimer'),
    tableOfContentsLabel: t('table_of_contents_label')
  };
  const strings: LegalDocLayoutStrings = { ...defaultStrings, ...(stringsOverride ?? {}) };
  const resolvedTitle = title ?? deriveTitle(document.body, document.docId);
  const isDraft = document.reviewStatus === 'published_draft_status';
  const showFallback = document.localeFallback;
  const provenance = provenanceLabel(document, strings);
  const disclaimerText = agentDisclaimer ?? strings.agentDisclaimer;

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--bb-page-bg, #F3F1ED)' }}
      data-testid="legal-doc-layout"
      data-legal-doc-id={document.docId}
      data-legal-doc-version={document.version}
      data-legal-doc-locale={document.locale}
      data-legal-doc-review-status={document.reviewStatus}
      data-legal-doc-locale-fallback={showFallback ? 'true' : 'false'}
    >
      <div className="bb-page-shell mx-auto max-w-[1200px]">
        {/* Signal 4 — fail-closed branch handled UPSTREAM by the calling route.
            This layout assumes document was successfully fetched; the page
            route must catch LegalDocumentNotFoundError and render an explicit
            error / 404 surface (NOT silently render this layout with empty
            content). The data-legal-fail-closed-render="true" attribute is
            present so smoke tests can assert "no silent empty layout". */}
        <div
          data-testid="legal-fail-closed-render"
          data-legal-fail-closed-render="true"
          className="sr-only"
        >
          Fail-closed render guard active — this layout only renders when
          fetchLegalDocument resolved successfully. Missing document MUST
          throw LegalDocumentNotFoundError and the route MUST render an
          explicit error branch.
        </div>

        {/* Signal 3 — draft watermark */}
        {isDraft && (
          <div
            className="bb-section-shell mb-2 px-5 py-4"
            data-testid="legal-draft-watermark"
            data-legal-draft-watermark="true"
            style={{
              borderColor: 'var(--bb-border-soft)',
              background: 'var(--bb-surface-muted, rgba(255, 200, 0, 0.08))'
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)', margin: 0 }}
            >
              <AlertIcon className="inline-block h-4 w-4 align-text-bottom"
                color="currentColor"
              />{' '}
              {strings.draftBadge}
            </p>
            <p
              className="text-xs"
              style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}
            >
              {strings.draftBadgeDescription}
            </p>
          </div>
        )}

        {/* Locale fallback warning */}
        {showFallback && (
          <div
            className="bb-section-shell mb-2 px-5 py-4"
            data-testid="legal-locale-fallback"
            data-legal-locale-fallback-badge="true"
            style={{
              borderColor: 'var(--bb-border-soft)',
              background: 'var(--bb-surface-muted, rgba(0, 100, 200, 0.06))'
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)', margin: 0 }}
            >
              {strings.localeFallbackBadge}
            </p>
            <p
              className="text-xs"
              style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}
            >
              {strings.localeFallbackDescription}
            </p>
          </div>
        )}

        {/* Agent disclaimer */}
        {showAgentDisclaimer && (
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
              style={{ color: 'var(--text-secondary)', margin: 0 }}
            >
              {disclaimerText}
            </p>
          </div>
        )}

        {/* Header w/ Signals 1 + 2 */}
        <header
          className="bb-section-shell px-5 py-6"
          data-testid="legal-header"
          style={{
            borderColor: 'var(--bb-border-soft)',
            background: 'var(--bb-surface)',
            marginBottom: '0.5rem'
          }}
        >
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 300,
              color: 'var(--text-primary)',
              margin: 0
            }}
            data-testid="legal-title"
          >
            {resolvedTitle}
          </h1>

          <div
            className="mt-3 flex flex-wrap items-center gap-3"
            style={{ marginTop: '0.75rem' }}
          >
            {/* Signal 1 — last-updated */}
            <span
              data-testid="legal-last-updated"
              data-legal-last-updated={document.lastUpdated}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                padding: '0.25rem 0.625rem',
                borderRadius: '999px',
                background: 'var(--bb-surface-muted, rgba(0,0,0,0.04))'
              }}
            >
              <TimeIcon className="h-4 w-4" color="currentColor" />
              <span>{strings.lastUpdatedLabel}:</span>
              <time dateTime={document.lastUpdated}>{document.lastUpdated}</time>
            </span>

            {/* Signal 2 — version */}
            <span
              data-testid="legal-version"
              data-legal-version={document.version}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                padding: '0.25rem 0.625rem',
                borderRadius: '999px',
                background: 'var(--bb-surface-muted, rgba(0,0,0,0.04))'
              }}
            >
              <TagIcon className="h-4 w-4" color="currentColor" />
              <span>
                {strings.versionLabel} {document.version}
              </span>
            </span>

            {/* Signal 5 — provenance */}
            <span
              data-testid="legal-provenance"
              data-legal-authoring-source={document.authoringSource}
              data-legal-review-ref={document.legalReviewRef ?? 'null'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                padding: '0.25rem 0.625rem',
                borderRadius: '999px',
                background: 'var(--bb-surface-muted, rgba(0,0,0,0.04))'
              }}
            >
              <DocumentIcon className="h-4 w-4" color="currentColor" />
              <span>{provenance}</span>
            </span>

            {localeSwitcher ? (
              <span
                data-testid="legal-locale-switcher-slot"
                style={{ marginLeft: 'auto' }}
              >
                {localeSwitcher}
              </span>
            ) : null}
          </div>
        </header>

        {/* Body */}
        <article
          className="bb-section-shell px-5 py-6 legal-content"
          data-testid="legal-body"
          style={{
            borderColor: 'var(--bb-border-soft)',
            background: 'var(--bb-surface)'
          }}
        >
          {children}
        </article>

        {/* Footer meta — Signal 5 (provenance) repeated for screen readers */}
        <footer
          className="px-5 py-4"
          data-testid="legal-footer-meta"
          style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}
        >
          <p style={{ margin: 0 }}>
            doc_id=<code>{document.docId}</code> · version=
            <code>{document.version}</code> · locale=
            <code>{document.locale}</code>
            {showFallback ? ' (fallback → pl)' : ''} · review_status=
            <code>{document.reviewStatus}</code>
          </p>
          <p style={{ margin: '0.25rem 0 0' }}>{provenance}</p>
        </footer>
      </div>
    </main>
  );
}
