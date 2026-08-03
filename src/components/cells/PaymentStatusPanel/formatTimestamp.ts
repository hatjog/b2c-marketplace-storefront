/**
 * formatLastUpdatedTimestamp — Pure helper for rendering the
 * `lastUpdate` field on PaymentStatusPanel.
 *
 * Story 2.4 review fixes (second pass):
 *   - R18: extracted as a pure helper so the format step is unit-testable
 *     without depending on the next-intl mock used by the panel tests.
 *   - R22: returns `null` (NOT the raw input) when the input is
 *     unparseable, so a malformed timestamp never leaks the raw ISO into
 *     the customer-facing UI.
 *
 * Returns a localised "{date} {time}" string for a valid ISO input, or
 * `null` for null/undefined/empty/invalid inputs.
 */
export function formatLastUpdatedTimestamp(
  lastUpdate: string | null | undefined,
): string | null {
  if (!lastUpdate) return null;
  try {
    const date = new Date(lastUpdate);
    if (Number.isNaN(date.getTime())) {
      // R22: do not return raw input on parse failure.
      return null;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return null;
  }
}
