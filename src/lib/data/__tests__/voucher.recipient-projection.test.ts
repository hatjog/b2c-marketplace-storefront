/**
 * v1.16.0 Story 6.9 AC3 (AD-51, K1, D-2): one state projection for every
 * screen of the recipient page; replaying the same response yields the same
 * state and the same canonical link.
 */
import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMercurClient: Record<string, unknown> = {};
const mockSdkFetch = vi.fn();

vi.mock('../../config', () => ({
  mercurClient: mockMercurClient,
  sdk: { client: { fetch: mockSdkFetch } },
}));

vi.mock('../cookies', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({}),
}));

const { getVoucherRecipientByCode } = await import('../voucher');
const { projectVoucherRecipientPage, VOUCHER_RECIPIENT_PAGE_STATES } = await import(
  '../voucher-recipient-projection'
);

const CODE = 'REPLAY-CODE-001';
/**
 * Fix R-1/R-2: the REAL response shape of `GET /store/vouchers/:code` —
 * exactly the keys of backend `projectAllowlist` (route.ts) — with no
 * public-entry confirmation flag (the endpoint does not return one).
 */
const PAYLOAD = {
  code: CODE,
  seller_id: 'sel_01',
  seller_name: 'Salon Test',
  seller_handle: 'salon-test',
  product_title: 'Manicure',
  value_minor: 10000,
  currency_code: 'PLN',
  status: 'idle',
  expires_at: '2026-12-31T00:00:00.000Z',
};

/** Backend `VoucherStatus` (models/types.ts) → recipient page state (D-2). */
const BACKEND_STATUS_TO_PAGE_STATE = {
  idle: 'active',
  consent_pending: 'active',
  claimed: 'redeemed',
  withdrawn: 'voided',
  expired: 'expired',
  refunded: 'voided',
} as const;

const BACKEND_ROOT = path.resolve(__dirname, '../../../../../backend/src');
const ROUTE = path.join(BACKEND_ROOT, 'api/store/vouchers/[code]/route.ts');
const TYPES = path.join(BACKEND_ROOT, 'modules/voucher/models/types.ts');
const backendPresent = fs.existsSync(ROUTE) && fs.existsSync(TYPES);

async function replay(response: () => void) {
  response();
  const first = projectVoucherRecipientPage(await getVoucherRecipientByCode(CODE), {
    locale: 'pl',
    code: CODE,
  });
  response();
  const second = projectVoucherRecipientPage(await getVoucherRecipientByCode(CODE), {
    locale: 'pl',
    code: CODE,
  });
  return [first, second] as const;
}

describe('projectVoucherRecipientPage — jedna projekcja i replay (AC3)', () => {
  beforeEach(() => {
    delete mockMercurClient.store;
    mockSdkFetch.mockReset();
  });

  it.skipIf(!backendPresent)('fixture = realny kształt endpointu (projectAllowlist + VoucherStatus z backendu)', () => {
    const route = fs.readFileSync(ROUTE, 'utf8');
    const allowlistBody = route.slice(route.indexOf('function projectAllowlist'));
    const returnAt = allowlistBody.indexOf('return {') + 'return {'.length;
    const returned = allowlistBody.slice(returnAt, allowlistBody.indexOf('}', returnAt));
    const keys = [...returned.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort();
    expect(keys).toEqual(Object.keys(PAYLOAD).sort());
    expect(route).not.toMatch(/public_entry_confirmed|gift_entry_confirmed/);

    const types = fs.readFileSync(TYPES, 'utf8');
    const union = types.slice(types.indexOf('export type VoucherStatus'), types.indexOf('export type VoucherEventType'));
    const statuses = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1]).sort();
    expect(statuses).toEqual(Object.keys(BACKEND_STATUS_TO_PAGE_STATE).sort());
  });

  it.each(Object.entries(BACKEND_STATUS_TO_PAGE_STATE))(
    'realny status backendu %s → stan strony %s (D-2: realizowalny = aktywny)',
    async (status, state) => {
      mockSdkFetch.mockResolvedValueOnce({ voucher: { ...PAYLOAD, status } });
      const projection = projectVoucherRecipientPage(await getVoucherRecipientByCode(CODE), {
        locale: 'pl',
        code: CODE,
      });
      expect(projection.state).toBe(state);
      expect(projection.view?.is_public_entry_confirmed).toBe(state === 'active');
    }
  );

  it('realny Response 200 z JSON-em idle → active (ścieżka accept */*)', async () => {
    mockSdkFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ voucher: PAYLOAD }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const result = await getVoucherRecipientByCode(CODE);
    expect(result).toMatchObject({ kind: 'ok', status: 200 });
    expect(projectVoucherRecipientPage(result, { locale: 'pl', code: CODE }).state).toBe('active');
  });

  it.each([
    ['active', { status: 'active' }, 'active'],
    ['idle', { status: 'idle' }, 'active'],
    ['nieznany status', { status: 'mystery' }, 'pending'],
    ['redeemed', { status: 'redeemed' }, 'redeemed'],
    ['expired', { status: 'expired' }, 'expired'],
    ['voided', { status: 'voided' }, 'voided'],
  ])('ta sama odpowiedź (%s) dwa razy → identyczny stan i link', async (_label, extra, state) => {
    const [first, second] = await replay(() =>
      mockSdkFetch.mockResolvedValueOnce({ voucher: { ...PAYLOAD, ...extra } })
    );
    expect(first.state).toBe(state);
    expect(second).toEqual(first);
    expect(second.canonicalHref).toBe(`/pl/voucher/${CODE}`);
  });

  it.each([403, 404, 503])('ta sama awaria %i dwa razy → identyczny stan i link', async (status) => {
    const [first, second] = await replay(() =>
      mockSdkFetch.mockRejectedValueOnce(Object.assign(new Error('x'), { status }))
    );
    expect(second).toEqual(first);
    expect(first.state).not.toBe('expired');
  });

  it('każdy stan ma unikalny klucz komunikatu i następną akcję', () => {
    const keys = new Set<string>();
    for (const state of VOUCHER_RECIPIENT_PAGE_STATES) {
      const projection = projectVoucherRecipientPage(
        state === 'loading'
          ? null
          : ['forbidden', 'not_found', 'technical_error'].includes(state)
            ? ({ kind: state, status: null, reason: 'network' } as never)
            : ({ kind: 'ok', status: null, view: { state: state === 'redeemed' ? 'already_redeemed' : state } } as never),
        { locale: 'pl', code: CODE }
      );
      expect(projection.state).toBe(state);
      keys.add(projection.messageKey);
      expect(projection.nextAction).toBeTruthy();
    }
    expect(keys.size).toBe(VOUCHER_RECIPIENT_PAGE_STATES.length);
  });

  it('page.tsx i VoucherRecipientView czytają stan z projekcji, bez lokalnych fallbacków', () => {
    const root = path.resolve(__dirname, '../../..');
    const page = fs.readFileSync(path.join(root, 'app/[locale]/voucher/[code]/page.tsx'), 'utf8');
    const view = fs.readFileSync(path.join(root, 'components/voucher/VoucherRecipientView.tsx'), 'utf8');

    expect(page).toContain('projectVoucherRecipientPage(');
    expect(page).toContain('data-state={projection.state}');
    for (const source of [page, view]) {
      expect(source).not.toMatch(/\?\?\s*'expired'/);
      expect(source).not.toMatch(/voucher\?\.state/);
    }
    expect(view).not.toMatch(/voucher\.state\s*===/);
  });
});
