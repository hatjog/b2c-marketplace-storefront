/**
 * Tests for voucher-consent Server Actions (cleanup-55 / TF-133 / Story 4.4).
 *
 * AC4: covers 6 scenarios per story spec:
 *  1. grant happy path → delivery-decision-recorded
 *  2. withdraw happy path → withdrawn
 *  3. pause happy path → consent-pending
 *  4. 401/403 auth failure → error-audit-failed (PII-free error string)
 *  5. network exception → error-audit-failed
 *  6. 2xx without audit id → error-audit-failed (missing-audit-id)
 *
 * AC1 (verb→endpoint): all three verbs POST to /store/voucher-pii-consent
 * (single endpoint; action discriminated via body field).
 * AC2: no STUB_TODO_MARKER, no synthetic 'stub-audit-id'.
 * TF-209: sdk.client.fetch used (auto-injects x-publishable-api-key).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock sdk.client.fetch — TF-209 migration target.
const mockSdkFetch = vi.fn();
vi.mock('@/lib/config', () => ({
  sdk: {
    client: {
      fetch: mockSdkFetch,
    },
  },
}));

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

function mockSdkOk(body: Record<string, unknown>): void {
  mockSdkFetch.mockResolvedValue(body);
}

function mockSdkStatus(status: number): void {
  mockSdkFetch.mockRejectedValue(Object.assign(new Error(`HTTP ${status}`), { status }));
}

function mockSdkThrows(message: string): void {
  mockSdkFetch.mockRejectedValue(new Error(message));
}

describe('voucher-consent Server Actions', () => {
  let grantConsent: (fd: FormData) => Promise<unknown>;
  let withdrawConsent: (fd: FormData) => Promise<unknown>;
  let pauseRecipient: (fd: FormData) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    mockSdkFetch.mockReset();
    const mod = await import('../voucher-consent');
    grantConsent = mod.grantConsent;
    withdrawConsent = mod.withdrawConsent;
    pauseRecipient = mod.pauseRecipient;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AC4.1 — grant happy path', () => {
    it('returns delivery-decision-recorded with auditId from backend', async () => {
      mockSdkOk({ audit_id: 'aud_123' });

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

      // AC1: sdk.client.fetch called with POST to /store/voucher-pii-consent (TF-209).
      expect(mockSdkFetch).toHaveBeenCalledOnce();
      const [path, opts] = mockSdkFetch.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: Record<string, unknown> }];
      expect(path).toBe('/store/voucher-pii-consent');
      expect(opts.method).toBe('POST');

      // Body contains action='grant' (verb discrimination via body).
      expect(opts.body.action).toBe('grant');

      // review M2: Idempotency-Key header present, deterministic shape.
      expect(opts.headers['Idempotency-Key']).toMatch(/^grant:tok_abc:\d+$/);
    });

    it('also accepts consent_audit_id from Story 2-2 full response shape', async () => {
      mockSdkOk({ consent_audit_id: 'aud_full_456' });

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { auditId?: string };

      expect(result.auditId).toBe('aud_full_456');
    });
  });

  describe('AC4.2 — withdraw happy path', () => {
    it('returns withdrawn with auditId', async () => {
      mockSdkOk({ withdrawal_audit_id: 'aud_withdraw_789' });

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

      const [path, opts] = mockSdkFetch.mock.calls[0] as [string, { body: Record<string, unknown> }];
      expect(path).toBe('/store/voucher-pii-consent');
      expect(opts.body.action).toBe('withdraw');
    });
  });

  describe('AC4.3 — pause happy path', () => {
    it('returns consent-pending', async () => {
      mockSdkOk({ pause_audit_id: 'aud_pause_999' });

      const fd = makeFormData({
        token: 'tok_abc',
        locale: 'pl',
        pause_state: 'considering',
        surface: 'js'
      });
      const result = await pauseRecipient(fd) as { ok: boolean; state: string };

      expect(result.ok).toBe(true);
      expect(result.state).toBe('consent-pending');

      const [path, opts] = mockSdkFetch.mock.calls[0] as [string, { body: Record<string, unknown> }];
      expect(path).toBe('/store/voucher-pii-consent');
      expect(opts.body.action).toBe('pause');
    });
  });

  describe('AC4.4 — 401 / 403 auth failure → graceful PII-free error', () => {
    it('returns error-audit-failed with no PII on 401', async () => {
      mockSdkStatus(401);

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };

      expect(result.ok).toBe(false);
      expect(result.state).toBe('error-audit-failed');
      // Review F14: stable error code, not English status text.
      expect(result.error).toBe('backend-error-401');
      expect(result.error).not.toContain('tok_abc');
    });

    it('returns error-audit-failed on 403', async () => {
      mockSdkStatus(403);

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };

      expect(result.ok).toBe(false);
      expect(result.state).toBe('error-audit-failed');
      expect(result.error).toBe('backend-error-403');
    });
  });

  describe('review F13 — pauseRecipient rejects invalid pause_state', () => {
    it('returns error-audit-failed with code invalid-pause-state', async () => {
      const fd = makeFormData({
        token: 'tok_abc',
        locale: 'pl',
        pause_state: 'not-a-state',
        surface: 'js',
      });
      const result = await pauseRecipient(fd) as { ok: boolean; state: string; error?: string };
      expect(result.ok).toBe(false);
      expect(result.state).toBe('error-audit-failed');
      expect(result.error).toBe('invalid-pause-state');
      expect(mockSdkFetch).not.toHaveBeenCalled();
    });
  });

  describe('AC4.5 — network exception → error-audit-failed', () => {
    it('returns generic network-error code without leaking raw message (review M3)', async () => {
      mockSdkThrows('connect ECONNREFUSED 127.0.0.1:9002');

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };

      expect(result.ok).toBe(false);
      expect(result.state).toBe('error-audit-failed');
      expect(result.error).toBe('network-error');
      expect(result.error).not.toContain('tok_abc');
      expect(result.error).not.toContain('127.0.0.1');
    });
  });

  describe('review M4 — 2xx response without audit id → error', () => {
    it('returns missing-audit-id when backend returns empty 200 body', async () => {
      mockSdkOk({});

      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };

      expect(result.ok).toBe(false);
      expect(result.state).toBe('error-audit-failed');
      expect(result.error).toBe('missing-audit-id');
    });
  });

  describe('validation edge cases (unchanged behaviour)', () => {
    it('grantConsent: missing token → error-audit-failed missing-token', async () => {
      const fd = makeFormData({ locale: 'pl', consent: 'on' });
      const result = await grantConsent(fd) as { ok: boolean; state: string; error?: string };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('missing-token');
      expect(mockSdkFetch).not.toHaveBeenCalled();
    });

    it('grantConsent: consent not granted → idle state', async () => {
      const fd = makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'false' });
      const result = await grantConsent(fd) as { ok: boolean; state: string };
      expect(result.ok).toBe(false);
      expect(result.state).toBe('idle');
      expect(mockSdkFetch).not.toHaveBeenCalled();
    });

    it('withdrawConsent: missing compensates_audit_id → error-audit-failed', async () => {
      const fd = makeFormData({ token: 'tok_abc', locale: 'pl' });
      const result = await withdrawConsent(fd) as { ok: boolean; state: string; error?: string };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('missing-compensates-audit-id');
      expect(mockSdkFetch).not.toHaveBeenCalled();
    });
  });

  describe('review hardening (H4 / I2 / L3)', () => {
    it('review L3: module does NOT export STUB_TODO_MARKER', async () => {
      const mod = (await import('../voucher-consent')) as Record<string, unknown>;
      expect(mod.STUB_TODO_MARKER).toBeUndefined();
    });

    it('review H4 / I2: revalidatePath uses parameterised tag and is skipped on error', async () => {
      const { revalidatePath } = (await import('next/cache')) as unknown as {
        revalidatePath: ReturnType<typeof vi.fn>;
      };
      revalidatePath.mockClear();

      // Error path → no revalidation.
      mockSdkOk({});
      const { grantConsent: grant } = await import('../voucher-consent');
      await grant(makeFormData({ token: 'tok_abc', locale: 'pl', consent: 'on' }));
      expect(revalidatePath).not.toHaveBeenCalled();

      // Success path → revalidation with parameterised tag (no token literal).
      mockSdkFetch.mockReset();
      mockSdkOk({ audit_id: 'aud_111' });
      await grant(makeFormData({ token: 'tok_secret_abc', locale: 'pl', consent: 'on' }));
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/voucher-pii-consent/[token]', 'page');
      for (const call of revalidatePath.mock.calls) {
        expect(String(call[0])).not.toContain('tok_secret_abc');
      }
    });
  });
});
