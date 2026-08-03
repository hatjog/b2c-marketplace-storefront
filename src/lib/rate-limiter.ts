// In-memory sliding window rate limiter: 10 requests per 60 seconds per IP.
// Note: in serverless/edge environments this is best-effort (per-instance state).
const rateLimitMap = new Map<string, number[]>();
export const RATE_LIMIT = 10;
export const WINDOW_MS = 60_000;
const CLEANUP_INTERVAL = 100; // purge stale entries every N calls
let callsSinceCleanup = 0;

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return '127.0.0.1';
}

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter(t => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    return true;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);

  // Periodic cleanup: remove IPs with no recent activity
  callsSinceCleanup++;
  if (callsSinceCleanup >= CLEANUP_INTERVAL) {
    callsSinceCleanup = 0;
    for (const [key, vals] of rateLimitMap) {
      if (vals.every(t => now - t >= WINDOW_MS)) {
        rateLimitMap.delete(key);
      }
    }
  }

  return false;
}

export function validateRevalidateSecret(
  headerValue: string | null,
  envSecret: string | undefined
): boolean {
  if (!headerValue || !envSecret) {
    return false;
  }
  return headerValue === envSecret;
}

/** Test-only: clear all rate limit state between tests. */
export function resetForTesting(): void {
  rateLimitMap.clear();
  callsSinceCleanup = 0;
}
