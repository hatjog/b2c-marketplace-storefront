/**
 * parse-purchase-mode — case-insensitive, injection-resistant parser for
 * self-purchase mode querystring parameter.
 *
 * Story: v160-cleanup-32-mv-pdp-residuals (TF-74)
 * Spec: AC5 — ?mode=GIFT, gift, Gift, gIfT all parse to SelfPurchaseMode.GIFT;
 *       invalid/missing → SelfPurchaseMode.SELF with console.warn.
 *
 * Replaces inline `rawMode === 'gift'` case-sensitive check in
 * CheckoutPurchaseMode.tsx (Story 5.8).
 *
 * Security:
 *  - Rejects non-string types (Number, Object, Array, null, undefined).
 *  - Sanitizes control characters (removes ASCII control chars 0x00-0x1F, 0x7F).
 *  - Truncates to 32 chars max before whitelist match (injection-length guard).
 *  - Whitelist enum: only 'SELF' and 'GIFT' accepted post-uppercase; any other
 *    value → fallback to SELF with console.warn.
 */

export const SelfPurchaseMode = {
  SELF: 'self',
  GIFT: 'gift'
} as const;

export type SelfPurchaseMode = (typeof SelfPurchaseMode)[keyof typeof SelfPurchaseMode];

/** Valid normalized values (post-uppercase). */
const VALID_MODES = new Set<string>(['SELF', 'GIFT']);

/** Max length guard: querystring injection attempts often use long strings. */
const MAX_RAW_LENGTH = 32;

/**
 * Parse `?mode=...` querystring parameter to `SelfPurchaseMode`.
 *
 * @param raw - Raw querystring value (from `searchParams.get('mode')`).
 *              Accepts `string | null | undefined`. Any other type also handled defensively.
 * @returns SelfPurchaseMode — always returns a valid enum value (never throws).
 */
export function parsePurchaseMode(raw: unknown): SelfPurchaseMode {
  // Reject non-string types (injection guard).
  if (typeof raw !== 'string') {
    if (raw !== null && raw !== undefined) {
      console.warn(
        `[self-purchase] invalid mode (non-string type: ${typeof raw}), defaulting to SELF`
      );
    }
    return SelfPurchaseMode.SELF;
  }

  // Sanitize control characters (0x00–0x1F, 0x7F) — injection guard.
  // eslint-disable-next-line no-control-regex
  const sanitized = raw.replace(/[\x00-\x1F\x7F]/g, '');

  // Truncate to max length before comparison.
  const truncated = sanitized.slice(0, MAX_RAW_LENGTH);

  // Case-insensitive whitelist match.
  const normalized = truncated.toUpperCase();

  if (!VALID_MODES.has(normalized)) {
    if (raw.length > 0) {
      // Non-empty but invalid — warn with sanitized value (never log raw for XSS safety).
      const safeDisplay = sanitized.slice(0, 20);
      console.warn(
        `[self-purchase] invalid mode "${safeDisplay}", defaulting to SELF`
      );
    }
    return SelfPurchaseMode.SELF;
  }

  return normalized === 'GIFT' ? SelfPurchaseMode.GIFT : SelfPurchaseMode.SELF;
}
