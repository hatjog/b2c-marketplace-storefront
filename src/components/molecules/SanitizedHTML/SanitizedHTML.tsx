import React from 'react';

import { sanitizeHtml } from '@/lib/security/sanitizeHtml';

interface Props {
  html: string | null | undefined;
  className?: string;
  /**
   * Shift heading levels in the supplied HTML by this delta after sanitization.
   * Used to integrate partner-authored content (which often starts at <h4>) into the
   * surrounding page outline without skipped levels (axe heading-order / WCAG 1.3.1).
   * Levels are clamped to [2, 6] so an <h1> is never emitted from embedded content.
   */
  headingShift?: number;
}

const HEADING_TAG = /<(\/?)(h)([1-6])\b/gi;

function shiftHeadingLevels(html: string, shift: number): string {
  if (!shift) return html;
  return html.replace(HEADING_TAG, (_match, slash: string, tag: string, level: string) => {
    const next = Math.min(6, Math.max(2, Number(level) + shift));
    return `<${slash}${tag}${next}`;
  });
}

/**
 * SanitizedHTML — molecule that renders user/partner-controlled HTML after passing it
 * through the canonical `sanitizeHtml()` helper (Story v160-4-7 anti-Booksy hardening).
 *
 * The helper uses isomorphic-dompurify (cure53/DOMPurify, SSR-compatible). All
 * raw-HTML React injection callsites for user-content surfaces (seller.description,
 * product.description, category.description, collection.description, comment/review body)
 * MUST go through this molecule (or call sanitizeHtml directly) — this enforces the
 * single display-time XSS defense layer per AR50 trust boundary.
 */
export function SanitizedHTML({ html, className, headingShift }: Props) {
  if (!html) return null;
  const clean = headingShift
    ? shiftHeadingLevels(sanitizeHtml(html), headingShift)
    : sanitizeHtml(html);

  // eslint-disable-next-line no-restricted-syntax -- the ONE allowed use; sanitizeHtml() has cleaned the input per Story v160-4-7
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
