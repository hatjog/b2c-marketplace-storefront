/**
 * Tests for voucher-consent Server Actions (cleanup-55 / TF-133).
 *
 * AC4: covers 6 scenarios per story spec:
 *  1. grant happy path → delivery-decision-recorded
 *  2. withdraw happy path → withdrawn
 *  3. pause happy path → consent-pending
 *  4. 401/403 auth failure → error-audit-failed (PII-free error string)
 *  5. backend-url-missing (no env var) → error-audit-failed (not synthetic success)
 *  6. network exception (fetch throws) → error-audit-failed
 *
 * AC1 (verb→endpoint): all three verbs POST to /store/voucher-pii-consent
 * (single endpoint; action discriminated via body field).
 * AC2: no STUB_TODO_MARKER, no synthetic 'stub-audit-id'.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// next/cache must be mocked before module imports — vitest module cache is
// populated on first import. The mock factory returns a no-op stub so the
// Server Action module loads cleanly in test environment.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// We need to control MEDUSA_BACKEND_URL per test; import after env is set.
// Use vi.resetModules() + dynamic import to isolate env per test group.

const BACKEND_URL = 'http://localhost:9002';

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

function mockFetchOk(body: Record<string, unknown>, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body)
    })
  );
}

function mockFetchStatus(status: number): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ error: `backend returned ${status}` })
    })
  );
}

function mockFetchThrows(message: string): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

describe('voucher-consent Server Actions — with backend URL', () => {
  let grantConsent: (fd: FormData) => Promise<unknown>;
  let withdrawConsent: (fd: FormData) => Promise<unknown>;
  let pauseRecipient: (fd: FormData) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.MEDUSA_BACKEND_URL = BACKEND_URL;
    delete process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
    const mod = await import('../voucher-consent');
    grantConsent = mod.grantConsent;
    withdrawConsent = mod.withdrawConsent;
    pauseRecipient = mod.pauseRecipient;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MEDUSA_BACKEND_URL;
  });

  describe('AC4.1 — grant happy path', () => {
    it('returns delivery-decision-recorded with auditId from backend', async () => {
      mockFetchOk({ audit_id: 'aud_123' });

      const fd = makeFormData({
        token: 'tok_abc',
        locale: 'pl',
        consent: 'on',
        surface: 'js'
      });
      const result = await grantConsent(fd) as { ok: boolean; state: string; auditId?: string };

      expect(result.ok).toBe(true);
      expect(result.state).toBe('delivery-decision-recorded');
      expect(result.auditId).toBe('aud_123');

      // AC1: fetch called with POST to /store/voucher-pii-consent (no verb suffix)
      const fetchMock = vi.mocked(fetch);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BACKEND_URL}/store/voucher-pii-consent`);
      expect(opts.method).toBe('POST');

      // Body contains action='grant' (verb discrimination via body)
      const body = JSON.parse(opts.body as string) as { action: string };
      expect(body.action).toBe('grant');
    });

    it('also accepts consent_audit_id from Story 2-2 full response shape', async () => {
      mockFetchOk({ consent_audit_id: 'aud_full_456' });

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { auditId?: string };

      expect(result.auditId).toBe('aud_full_456');
    });
  });

  describe('AC4.2 — withdraw happy path', () => {
    it('returns withdrawn with auditId', async () => {
      mockFetchOk({ audit_id: 'aud_withdraw_789' });

      const fd = makeFormData({
        token: 'tok_abc',
        locale: 'pl',
        compensates_audit_id: 'aud_original_001',
        surface: 'no-js'
      });
      const result = await withdrawConsent(fd) as { ok: boolean; state: string; auditId?: string };

      expect(result.ok).toBe(true);
      expect(result.state).toBe('withdrawn');
      expect(result.auditId).toBe('aud_withdraw_789');

      const fetchMock = vi.mocked(fetch);
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BACKEND_URL}/store/voucher-pii-consent`);
      const body = JSON.parse(opts.body as string) as { action: string };
      expect(body.action).toBe('withdraw');
    });
  });

  describe('AC4.3 — pause happy path', () => {
    it('returns consent-pending', async () => {
      mockFetchOk({ audit_id: 'aud_pause_999' });

      const fd = makeFormData({
        token: 'tok_abc',
        locale: 'pl',
        pause_state: 'considering',
        surface: 'js'
      });
      const result = await pauseRecipient(fd) as { ok: boolean; state: string };

      expect(result.ok).toBe(true);
      expect(result.state).toBe('consent-pending');

      const fetchMock = vi.mocked(fetch);
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BACKEND_URL}/store/voucher-pii-consent`);
      const body = JSON.parse(opts.body as string) as { action: string };
      expect(body.action).toBe('pause');
    });
  });

  describe('AC4.4 — 401 / 403 auth failure → graceful PII-free error', () => {
    it('returns error-audit-failed with no PII on 401', async () => {
      mockFetchStatus(401);

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };

      expect(result.ok).toBe(false);
      expect(result.state).toBe('error-audit-failed');
      expect(result.error).toBe('backend returned 401');
      // Error string must NOT contain the token or payload
      expect(result.error).not.toContain('tok_abc');
    });

    it('returns error-audit-failed on 403', async () => {
      mockFetchStatus(403);

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };

      expect(result.ok).toBe(false);
      expect(result.state).toBe('error-audit-failed');
      expect(result.error).toBe('backend returned 403');
    });
  });

  describe('AC4.6 — network exception (fetch throws) → error-audit-failed', () => {
    it('propagates network error without leaking PII', async () => {
      mockFetchThrows('ECONNREFUSED');

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };

      expect(result.ok).toBe(false);
      expect(result.state).toBe('error-audit-failed');
      expect(result.error).toBe('ECONNREFUSED');
      // Must not contain token/payload in error string
      expect(result.error).not.toContain('tok_abc');
    });
  });
});

describe('voucher-consent Server Actions — without backend URL (AC4.5 / AC2)', () => {
  let grantConsent: (fd: FormData) => Promise<unknown>;
  let withdrawConsent: (fd: FormData) => Promise<unknown>;
  let pauseRecipient: (fd: FormData) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.MEDUSA_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
    const mod = await import('../voucher-consent');
    grantConsent = mod.grantConsent;
    withdrawConsent = mod.withdrawConsent;
    pauseRecipient = mod.pauseRecipient;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('grant: returns backend-url-missing error — NOT synthetic success', async () => {
    // AC2: no synthetic auditId='stub-audit-id'; AC4.5: explicit error
    const fd = makeFormData({ token: 'tok_xyz', locale: 'pl', consent: 'on' });
    const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string; auditId?: string };

    expect(result.ok).toBe(false);
    expect(result.state).toBe('error-audit-failed');
    expect(result.error).toBe('backend-url-missing');
    expect(result.auditId).toBeUndefined();
    // AC2: no synthetic stub-audit-id
    expect(result.auditId).not.toBe('stub-audit-id');
  });

  it('withdraw: returns backend-url-missing error — NOT synthetic success', async () => {
    const fd = makeFormData({
      token: 'tok_xyz',
      locale: 'pl',
      compensates_audit_id: 'aud_001'
    });
    const result = await withdrawConsent(fd) as { ok: boolean; state: string; error?: string };

    expect(result.ok).toBe(false);
    expect(result.state).toBe('error-audit-failed');
    expect(result.error).toBe('backend-url-missing');
  });

  it('pause: returns backend-url-missing error — NOT synthetic success', async () => {
    const fd = makeFormData({ token: 'tok_xyz', locale: 'pl', pause_state: 'paused' });
    const result = await pauseRecipient(fd) as { ok: boolean; state: string; error?: string };

    expect(result.ok).toBe(false);
    expect(result.state).toBe('error-audit-failed');
    expect(result.error).toBe('backend-url-missing');
  });

  it('fetch is never called when backend URL is missing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const fd = makeFormData({ token: 'tok_xyz', locale: 'pl', consent: 'on' });
    await grantConsent(fd);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('voucher-consent — validation edge cases (unchanged behaviour)', () => {
  let grantConsent: (fd: FormData) => Promise<unknown>;
  let withdrawConsent: (fd: FormData) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.MEDUSA_BACKEND_URL = BACKEND_URL;
    const mod = await import('../voucher-consent');
    grantConsent = mod.grantConsent;
    withdrawConsent = mod.withdrawConsent;
  });

  afterEach(() => {
    delete process.env.MEDUSA_BACKEND_URL;
  });

  it('grantConsent: missing token → error-audit-failed missing-token', async () => {
    const fd = makeFormData({ locale: 'pl', consent: 'on' });
    const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };
    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing-token');
  });

  it('grantConsent: consent not granted → idle state', async () => {
    const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'false' });
    const result = await grantConsent(fd) as { ok: boolean; state: string };
    expect(result.ok).toBe(false);
    expect(result.state).toBe('idle');
  });

  it('withdrawConsent: missing compensates_audit_id → error-audit-failed', async () => {
    const fd = makeFormData({ token: 'tok_abc', locale: 'pl' });
    const result = await withdrawConsent(fd) as { ok: boolean; state: string; error?: string };
    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing-compensates-audit-id');
  });
});
