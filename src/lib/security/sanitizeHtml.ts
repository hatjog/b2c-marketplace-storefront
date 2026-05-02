/**
 * sanitizeHtml — display-time XSS sanitization helper for partner-imported HTML content.
 *
 * Trust boundary (per architecture.md AR50 + NFR-SEC-3):
 * Backend (Mercur 2) stores raw HTML preserving source fidelity for audit traceability
 * with partner content disputes (Booksy / 3rd-party CMS imports). Storefront enforces
 * sanitization at render time. This helper is the single source of truth for any code
 * path that injects user / partner-controlled content into the React DOM via the
 * raw-HTML React prop (seller.description, product.description, comment.body, review.body).
 *
 * Library: `isomorphic-dompurify` — wraps cure53/DOMPurify (industry-standard, audited
 * 2014-2026, 13k+ stars) with auto JSDOM bootstrap for SSR (Next.js 15+ Server Components).
 * Ships own TypeScript types, works in both server and client execution contexts.
 *
 * Whitelist rationale (per Story v160-4-7 AC2):
 * - Allowed tags cover legitimate rich-text formatting needed by salon descriptions and
 *   product copy: paragraphs, lists, headings (h1-h6), inline emphasis, anchors, blockquotes,
 *   safe layout primitives (span/div with class only).
 * - Forbidden tags cover XSS execution surfaces: script, iframe, object, embed, form/input/
 *   button (UI hijack), style/link/meta/base (DOM-level injection), svg/math (DOMXSS).
 * - Allowed attrs are narrow per-tag (a -> href/target/rel; span/div -> class only) to prevent
 *   attribute-based vector injection (e.g. inline event handlers, srcset SSRF).
 * - Forbidden URI schemes block javascript:, data:, vbscript:, file: in href; only
 *   http(s)/mailto/tel are permitted.
 * - All <a> tags get rel="noopener noreferrer" auto-injected (defends against
 *   window.opener phishing per OWASP HTML5 cheatsheet); target="_blank" pairs with rel.
 *
 * Defense layer: this is a single display-time defense. CSP headers (script-src 'self')
 * are an orthogonal complementary layer deferred to Epic 7 / v1.7.0+.
 *
 * @see _bmad-output/implementation-artifacts/v160/v160-4-7-anti-booksy-html-sanitization.md
 * @see https://github.com/cure53/DOMPurify
 * @see https://owasp.org/www-project-top-ten/2017/A7_2017-Cross-Site_Scripting_(XSS)
 */

import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'div',
  'blockquote',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'title'];

const FORBID_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'style',
  'link',
  'meta',
  'base',
  'svg',
  'math',
];

// `style` strips inline style="..." (CSS injection / data exfiltration via background-image url).
// `srcset` strips responsive-image set attribute (SSRF surface for proxy fetchers).
// `on*` event handler attributes are stripped via DOMPurify's default deny pattern.
const FORBID_ATTR = ['style', 'srcset'];

// Permitted URI schemes for `href`. Default DOMPurify behavior already blocks
// the javascript: URI scheme; this explicit whitelist regex enforces the additional
// data: / vbscript: / file: denials per Story 4.7 AC2.
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

let hookInstalled = false;

/**
 * Install a DOMPurify hook (idempotent) that enforces rel="noopener noreferrer" on every
 * <a> tag with an href, regardless of whether the source HTML supplies its own rel value.
 * Defends against window.opener navigation hijack (OWASP HTML5 Security cheatsheet).
 */
function ensureRelNoopenerHook(): void {
  if (hookInstalled) return;
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  hookInstalled = true;
}

/**
 * Sanitize partner-imported / user-content HTML for safe React DOM injection.
 *
 * Tolerant of `null` / `undefined` / empty inputs (returns empty string — defensive guard
 * for backend payloads where description fields are nullable).
 *
 * @param html Raw HTML string (or nullable equivalent) from a user / partner source.
 * @returns Sanitized HTML string with whitelist applied; safe to pass into the
 *          React raw-HTML inject prop.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (html === null || html === undefined || html === '') {
    return '';
  }

  ensureRelNoopenerHook();

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOWED_URI_REGEXP,
    // Keep relative URLs in href (legitimate internal links inside descriptions).
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // Return string (default); never return a DOM node.
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  }) as string;
}
