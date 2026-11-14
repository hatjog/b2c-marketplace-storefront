/**
 * v1.16.0 Story 6.9 AC2 (AD-50, AD-51): the recipient lookup keeps the
 * transport class. 403/404/5xx/non-JSON never collapse into `null` or
 * `expired`, and the HTTP status survives to the UX projection.
 */
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
const { projectVoucherRecipientPage } = await import('../voucher-recipient-projection');

const CODE = 'REAL-RECIPIENT-CODE-01';

class FetchError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

function assertNotCollapsed(result: Awaited<ReturnType<typeof getVoucherRecipientByCode>>) {
  expect(result).not.toBeNull();
  expect(result.kind).not.toBe('ok');
  const projection = projectVoucherRecipientPage(result, { locale: 'pl', code: CODE });
  expect(projection.state).not.toBe('expired');
  expect(projection.view).toBeNull();
  return projection;
}

describe('getVoucherRecipientByCode — klasa transportu (AC2)', () => {
  beforeEach(() => {
    delete mockMercurClient.store;
    mockSdkFetch.mockReset();
  });

  it.each([
    [401, 'forbidden'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [500, 'technical_error'],
    [502, 'technical_error'],
    [503, 'technical_error'],
  ] as const)('raw fetch %i → %s ze statusem w wyniku', async (status, kind) => {
    mockSdkFetch.mockRejectedValue(new FetchError(status));

    const result = await getVoucherRecipientByCode(CODE);

    expect(result.kind).toBe(kind);
    expect(result.status).toBe(status);
    const projection = assertNotCollapsed(result);
    expect(projection.state).toBe(kind);
    expect(projection.transportStatus).toBe(status);
  });

  it.each([
    [403, 'forbidden'],
    [404, 'not_found'],
  ] as const)('typed client %i jest odpowiedzią rozstrzygającą (%s), bez fallbacku', async (status, kind) => {
    mockMercurClient.store = {
      vouchers: { byCode: vi.fn().mockRejectedValue(new FetchError(status)) },
    };

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind, status });
    expect(mockSdkFetch).not.toHaveBeenCalled();
    assertNotCollapsed(result);
  });

  it('typed client 503 próbuje fallback i zachowuje 5xx fallbacku', async () => {
    mockMercurClient.store = {
      vouchers: { byCode: vi.fn().mockRejectedValue(new FetchError(503)) },
    };
    mockSdkFetch.mockRejectedValue(new FetchError(502));

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind: 'technical_error', status: 502 });
    assertNotCollapsed(result);
  });

  it('nie-JSON (SyntaxError przy parsowaniu) → technical_error', async () => {
    mockSdkFetch.mockRejectedValue(new SyntaxError('Unexpected token < in JSON'));

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind: 'technical_error', reason: 'non_json' });
    assertNotCollapsed(result);
  });

  it('nie-JSON (ciało tekstowe zamiast obiektu) → technical_error', async () => {
    mockSdkFetch.mockResolvedValue('<html>Bad gateway</html>');

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind: 'technical_error', reason: 'non_json' });
    assertNotCollapsed(result);
  });

  it('nie-JSON z kodem HTTP (502 z HTML) zachowuje status', async () => {
    mockSdkFetch.mockRejectedValue(new FetchError(502));

    const result = await getVoucherRecipientByCode(CODE);

    expect(result.status).toBe(502);
    expect(result.kind).toBe('technical_error');
  });

  it('obiekt JSON bez kształtu vouchera → technical_error (malformed), nie wygasł', async () => {
    mockSdkFetch.mockResolvedValue({ unexpected: true });

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind: 'technical_error', reason: 'malformed_payload' });
    assertNotCollapsed(result);
  });

  it('błąd sieci bez statusu → technical_error', async () => {
    mockSdkFetch.mockRejectedValue(new TypeError('fetch failed'));

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind: 'technical_error', status: null, reason: 'network' });
    assertNotCollapsed(result);
  });
});
