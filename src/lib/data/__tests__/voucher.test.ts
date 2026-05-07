/**
 * Tests for voucher data layer (cleanup-55 / TF-134).
 *
 * AC4 (lib/data/voucher.ts portion):
 *  - Path B (typed mercurClient) success → returns VoucherPublicView via AR45 allowlist
 *  - Raw fetch fallback success (when typed path unavailable/throws)
 *  - Both fail → null (production code) or fixture (E2E known code)
 *  - E2E escape hatch: E2E_CLAIMED_FIXTURE_CODE bypasses network calls
 *  - getVoucherEvents: Path B success, raw fallback, both fail → []
 *
 * AR45 invariant: only allowlisted fields survive projection; buyer-side
 * fields are stripped at the module boundary.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the config module — mercurClient and sdk are singletons initialized
// at module load time. We provide controllable stubs.
const mockMercurClient: Record<string, unknown> = {};
const mockSdkFetch = vi.fn();

// review M5: mock the SUT's actual relative import specifier so the mock
// remains pinned to `voucher.ts` even if the file is moved (alias-resolution
// coincidence is not a stable contract).
vi.mock('../../config', () => ({
  mercurClient: mockMercurClient,
  sdk: {
    client: {
      fetch: mockSdkFetch
    }
  }
}));

// Import after mocks are set up.
const { getVoucherByCode, getVoucherEvents } = await import('../voucher');

const E2E_CLAIMED_CODE = 'E2E-CLAIMED-VOUCHER-002';
const REAL_CODE = 'TEST-VOUCHER-001';

const VALID_VOUCHER_PAYLOAD = {
  code: REAL_CODE,
  seller_id: 'sel_01TEST00000',
  seller_name: 'Test Seller',
  seller_handle: 'test-seller',
  product_title: 'Test Product',
  value_minor: 9900,
  currency_code: 'PLN',
  status: 'idle',
  expires_at: null,
  // Buyer-side fields that should be stripped by AR45 allowlist:
  buyer_email: 'buyer@example.com',
  buyer_phone: '+48123456789',
  internal_notes: 'secret internal data'
};

describe('getVoucherByCode', () => {
  beforeEach(() => {
    // Reset mock client state
    delete mockMercurClient.store;
    mockSdkFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AC4 — Path B (typed mercurClient) success', () => {
    it('returns projected VoucherPublicView stripping buyer-side fields (AR45)', async () => {
      mockMercurClient.store = {
        vouchers: {
          byCode: vi.fn().mockResolvedValue({ voucher: VALID_VOUCHER_PAYLOAD })
        }
      };

      const result = await getVoucherByCode(REAL_CODE);

      expect(result).not.toBeNull();
      expect(result!.code).toBe(REAL_CODE);
      expect(result!.seller_name).toBe('Test Seller');
      expect(result!.status).toBe('idle');
      // AR45: buyer fields MUST be stripped
      expect(result).not.toHaveProperty('buyer_email');
      expect(result).not.toHaveProperty('buyer_phone');
      expect(result).not.toHaveProperty('internal_notes');
    });

    it('normalises status values (consent-pending, claimed, withdrawn)', async () => {
      for (const [input, expected] of [
        ['consent-pending', 'consent_pending'],
        ['consent_pending', 'consent_pending'],
        ['pending', 'consent_pending'],
        ['claimed', 'claimed'],
        ['redeemed', 'claimed'],
        ['withdrawn', 'withdrawn'],
        ['revoked', 'withdrawn'],
        ['idle', 'idle'],
        ['unknown', 'idle']
      ]) {
        mockMercurClient.store = {
          vouchers: {
            byCode: vi.fn().mockResolvedValue({
              voucher: { ...VALID_VOUCHER_PAYLOAD, status: input }
            })
          }
        };
        const result = await getVoucherByCode(REAL_CODE);
        expect(result?.status, `status='${input}'`).toBe(expected);
      }
    });
  });

  describe('AC4 — raw fetch fallback (when typed path unavailable)', () => {
    it('falls back to sdk.client.fetch when mercurClient.store.vouchers not available', async () => {
      // No store.vouchers on mercurClient
      mockMercurClient.store = {};
      mockSdkFetch.mockResolvedValue({ voucher: VALID_VOUCHER_PAYLOAD });

      const result = await getVoucherByCode(REAL_CODE);

      expect(result).not.toBeNull();
      expect(result!.code).toBe(REAL_CODE);
      expect(mockSdkFetch).toHaveBeenCalledWith(
        `/store/vouchers/${REAL_CODE}`,
        { method: 'GET' }
      );
    });

    it('falls back to sdk.client.fetch when typed path throws', async () => {
      mockMercurClient.store = {
        vouchers: {
          byCode: vi.fn().mockRejectedValue(new Error('SDK error'))
        }
      };
      mockSdkFetch.mockResolvedValue({ voucher: VALID_VOUCHER_PAYLOAD });

      const result = await getVoucherByCode(REAL_CODE);

      expect(result).not.toBeNull();
      expect(result!.seller_id).toBe('sel_01TEST00000');
    });

    it('strips buyer-side fields even via raw fetch path (AR45)', async () => {
      mockMercurClient.store = {};
      mockSdkFetch.mockResolvedValue({ voucher: VALID_VOUCHER_PAYLOAD });

      const result = await getVoucherByCode(REAL_CODE);

      expect(result).not.toHaveProperty('buyer_email');
      expect(result).not.toHaveProperty('internal_notes');
    });
  });

  describe('AC4 — both paths fail → null (production) or fixture (E2E)', () => {
    it('returns null for unknown production code when both paths fail', async () => {
      mockMercurClient.store = {};
      mockSdkFetch.mockRejectedValue(new Error('404 Not Found'));

      const result = await getVoucherByCode('NONEXISTENT-CODE-999');

      expect(result).toBeNull();
    });

    it('returns fixture data for E2E_CLAIMED_FIXTURE_CODE regardless of network', async () => {
      mockMercurClient.store = {};
      mockSdkFetch.mockRejectedValue(new Error('network down'));

      const result = await getVoucherByCode(E2E_CLAIMED_CODE);

      expect(result).not.toBeNull();
      expect(result!.code).toBe(E2E_CLAIMED_CODE);
      expect(result!.status).toBe('claimed');
      // E2E fixture returns known data without hitting backend
    });
  });

  describe('Input validation', () => {
    it('returns null for empty code', async () => {
      expect(await getVoucherByCode('')).toBeNull();
    });

    it('returns null for code shorter than 3 chars', async () => {
      expect(await getVoucherByCode('AB')).toBeNull();
    });
  });
});

describe('getVoucherEvents', () => {
  beforeEach(() => {
    delete mockMercurClient.store;
    mockSdkFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const MOCK_EVENTS_PAYLOAD = [
    {
      id: 'evt_001',
      event_type: 'created',
      occurred_at: '2026-05-01T10:00:00.000Z',
      buyer_note: 'secret buyer note' // should be stripped
    },
    {
      id: 'evt_002',
      event_type: 'sent',
      occurred_at: '2026-05-01T11:00:00.000Z'
    }
  ];

  describe('Path B (typed mercurClient) success', () => {
    it('returns allowlist-projected events sorted by occurred_at', async () => {
      mockMercurClient.store = {
        vouchers: {
          events: vi.fn().mockResolvedValue({ events: MOCK_EVENTS_PAYLOAD })
        }
      };

      const result = await getVoucherEvents(REAL_CODE);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('evt_001');
      expect(result[0].event_type).toBe('created');
      // AR45: buyer fields stripped
      expect(result[0]).not.toHaveProperty('buyer_note');
      expect(result[0].metadata).toEqual({});
    });

    it('filters out events with unknown event_type', async () => {
      mockMercurClient.store = {
        vouchers: {
          events: vi.fn().mockResolvedValue({
            events: [
              { id: 'evt_001', event_type: 'created', occurred_at: '2026-05-01T10:00:00.000Z' },
              { id: 'evt_bad', event_type: 'UNKNOWN_TYPE', occurred_at: '2026-05-01T10:01:00.000Z' }
            ]
          })
        }
      };

      const result = await getVoucherEvents(REAL_CODE);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('evt_001');
    });
  });

  describe('Raw fetch fallback', () => {
    it('falls back to sdk.client.fetch when typed path unavailable', async () => {
      mockMercurClient.store = {};
      mockSdkFetch.mockResolvedValue({ events: MOCK_EVENTS_PAYLOAD });

      const result = await getVoucherEvents(REAL_CODE);

      expect(result).toHaveLength(2);
      expect(mockSdkFetch).toHaveBeenCalledWith(
        `/store/vouchers/${REAL_CODE}/events`,
        { method: 'GET' }
      );
    });
  });

  describe('Both paths fail → empty array (production)', () => {
    it('returns empty array when both paths fail for production code', async () => {
      mockMercurClient.store = {};
      mockSdkFetch.mockRejectedValue(new Error('network error'));

      const result = await getVoucherEvents('PROD-CODE-NO-EVENTS');

      expect(result).toEqual([]);
    });

    it('returns fixture events for E2E_CLAIMED_FIXTURE_CODE', async () => {
      mockMercurClient.store = {};
      mockSdkFetch.mockRejectedValue(new Error('network down'));

      const result = await getVoucherEvents(E2E_CLAIMED_CODE);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].event_type).toBe('created');
    });
  });

  describe('Input validation', () => {
    it('returns empty array for empty code', async () => {
      expect(await getVoucherEvents('')).toEqual([]);
    });
  });
});
