/**
 * Story v160-6-7: Service worker registration helper.
 *
 * Idempotent — bails out when called outside the browser, when the SW API
 * is unavailable, or when already registered. Scope-limited to /voucher/.
 */

let registered = false;

export async function registerVoucherServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (registered) return;
  registered = true;

  try {
    await navigator.serviceWorker.register('/voucher-sw.js', { scope: '/voucher/' });
  } catch {
    // SW registration failures are non-fatal — the online claim flow
    // continues to work; offline tolerance is degraded.
    registered = false;
  }
}
