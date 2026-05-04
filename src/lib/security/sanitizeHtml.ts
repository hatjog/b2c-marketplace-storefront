/**
 * sanitizeHtml — display-time XSS sanitization helper for partner-imported HTML content.
 *
 * Story v160-cleanup-4: HIGH-4.1 + CRIT-7.3 fixes applied —
 *   - `title` removed from ALLOWED_ATTR (URL-shadow phishing vector on <a>)
 *   - ALLOWED_URI_REGEXP tightened to match docstring contract exactly
 *   - formaction added to FORBID_ATTR
 *   - he entity pre-decode added before DOMPurify pass (CRIT-7.3)
 *   - Per-tag afterSanitizeAttributes hook ensures <a> only keeps href/rel/target
 *
 * last-synced-from: e4b400a60e7b5866794b35b249c62b3a895ce9c9 (packages/sanitize/src/index.ts)
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
 *
 * @see packages/sanitize/README.md for sync policy
 * @see https://github.com/cure53/DOMPurify
 * @see https://owasp.org/www-project-top-ten/2017/A7_2017-Cross-Site_Scripting_(XSS)
 */

import DOMPurify from 'isomorphic-dompurify';
import he from 'he';

export const SANITIZE_VERSION = 'v1.6.0-cleanup4-dompurify';

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
  'code',
  'pre',
];

// title REMOVED (HIGH-4.1: URL-shadow phishing — attacker sets title="https://safe.com"
// while href points elsewhere). Per-tag hook below enforces <a> attrs strictly.
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'cite'];

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
  'canvas',
  'video',
  'audio',
];

// `style` strips inline style="..." (CSS injection).
// `srcset` strips responsive-image set attribute (SSRF surface for proxy fetchers).
// `formaction` added (CRIT-7.3: formaction on <a> bypass).
const FORBID_ATTR = ['style', 'srcset', 'formaction', 'action', 'ping'];

// Permitted URI schemes for `href`.
// Tightened (HIGH-4.1): previous regex was more permissive than docstring claimed.
// Now matches docstring contract exactly: https, http, mailto, tel, relative paths.
// Rejected: javascript:, data:, vbscript:, file:, blob:
export const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|\/|[^:]*$|#)/i;

let hookInstalled = false;

/**
 * Install a DOMPurify hook (idempotent) that:
 * 1. Enforces rel="noopener noreferrer" on every <a> with href
 * 2. Strips any attribute on <a> not in the strict allowlist (href, rel, target)
 *    — removes title, hreflang, formaction, etc.
 */
function ensureHooks(): void {
  if (hookInstalled) return;
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('rel', 'noopener noreferrer');
      const allowed = new Set(['href', 'rel', 'target']);
      for (const attr of Array.from(node.attributes)) {
        if (!allowed.has(attr.name)) {
          node.removeAttribute(attr.name);
        }
      }
    }
  });
  hookInstalled = true;
}

/**
 * Sanitize partner-imported / user-content HTML for safe React DOM injection.
 *
 * Steps (v160-cleanup-4):
 *  1. Null/empty guard
 *  2. HTML entity pre-decode (he.decode) — prevents entity-encoded XSS (CRIT-7.3)
 *  3. DOMPurify with tightened URI regexp + FORBID_ATTR including formaction
 *  4. Per-tag hook: strips title/formaction/etc from <a>
 *
 * @param html Raw HTML string (or nullable equivalent) from a user / partner source.
 * @returns Sanitized HTML string with whitelist applied; safe for dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (html === null || html === undefined || html === '') {
    return '';
  }

  ensureHooks();

  // Pre-decode HTML entities before DOMPurify pass.
  // Prevents: &lt;script&gt;alert(1)&lt;/script&gt; from bypassing sanitizer (CRIT-7.3).
  const decoded = he.decode(html);

  return DOMPurify.sanitize(decoded, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOWED_URI_REGEXP,
    // DOMPurify strips HTML comments by default in Node/JSDOM context.
    ALLOW_UNKNOWN_PROTOCOLS: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  }) as string;
}
