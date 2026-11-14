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
const PAYLOAD = {
  code: CODE,
  seller_id: 'sel_01',
  seller_name: 'Salon Test',
  seller_handle: 'salon-test',
  product_title: 'Manicure',
  value_minor: 10000,
  currency_code: 'PLN',
  is_public_entry_confirmed: true,
};

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

  it.each([
    ['active', { status: 'active' }, 'active'],
    ['issued bez potwierdzenia gift entry', { status: 'issued', is_public_entry_confirmed: false }, 'pending'],
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
