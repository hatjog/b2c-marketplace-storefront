import { sanitizeHtml } from '@/lib/security/sanitizeHtml';

interface Props {
  html: string | null | undefined;
  className?: string;
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
export function SanitizedHTML({ html, className }: Props) {
  if (!html) return null;
  const clean = sanitizeHtml(html);

  // eslint-disable-next-line no-restricted-syntax -- the ONE allowed use; sanitizeHtml() has cleaned the input per Story v160-4-7
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
