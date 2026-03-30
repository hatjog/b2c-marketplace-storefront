import DOMPurify from 'dompurify';

/**
 * Sanitize user-provided HTML for client-side rendering.
 * MUST be called before rendering any HTML received from API in client components.
 * Uses DOMPurify (browser-native, ~7KB gzip).
 */
export function sanitizeOnFetch(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4'],
    ALLOWED_ATTR: ['href'],
    ADD_ATTR: ['target', 'rel'],
  });
}
