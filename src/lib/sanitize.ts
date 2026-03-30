import DOMPurify from 'dompurify';

/**
 * Sanitize user-provided HTML for client-side rendering.
 * MUST be called before rendering any HTML received from API in client components.
 * Uses DOMPurify (browser-native, ~7KB gzip).
 *
 * @throws Will throw if called in a server component (DOMPurify requires window/document).
 *         Use SanitizedHTML for server-side rendering instead.
 */
export function sanitizeOnFetch(html: string): string {
  if (typeof window === 'undefined') {
    // SSR: DOMPurify requires DOM — return as-is; SanitizedHTML handles SSR sanitization.
    return html;
  }

  // Inject rel="noopener noreferrer" target="_blank" on all <a> tags after sanitization
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });

  DOMPurify.removeHook('afterSanitizeAttributes');

  return clean;
}
