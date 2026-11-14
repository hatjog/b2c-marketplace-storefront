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
    [410, 'not_found'],
    // Fix R-3: 400 = platform failure (publishable key), not "voucher not found".
    [400, 'technical_error'],
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

  it('400 (awaria klucza publishable) nie jest not_found i nie kieruje do „sprawdź link” (R-3)', async () => {
    mockSdkFetch.mockRejectedValue(new FetchError(400));

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind: 'technical_error', status: 400, reason: 'http_status' });
    const projection = assertNotCollapsed(result);
    expect(projection.state).toBe('technical_error');
    expect(projection.transportStatus).toBe(400);
    expect(projection.nextAction).toBe('retry');
  });

  it('typed client nie jest wołany — jedyna ścieżka to raw fetch (R-9)', async () => {
    const byCode = vi.fn().mockRejectedValue(new FetchError(404));
    mockMercurClient.store = { vouchers: { byCode } };
    mockSdkFetch.mockRejectedValue(new FetchError(503));

    const result = await getVoucherRecipientByCode(CODE);

    expect(byCode).not.toHaveBeenCalled();
    expect(mockSdkFetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ kind: 'technical_error', status: 503 });
  });

  it('HTTP 200 z ciałem nie-JSON zachowuje status transportu (R-4)', async () => {
    mockSdkFetch.mockResolvedValue(
      new Response('<html>maintenance</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    );

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind: 'technical_error', status: 200, reason: 'non_json' });
    const projection = assertNotCollapsed(result);
    expect(projection.transportStatus).toBe(200);
  });

  it('HTTP 200 z JSON-em bez kształtu vouchera zachowuje status (R-4)', async () => {
    mockSdkFetch.mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));

    const result = await getVoucherRecipientByCode(CODE);

    expect(result).toMatchObject({ kind: 'technical_error', status: 200, reason: 'malformed_payload' });
    expect(projectVoucherRecipientPage(result, { locale: 'pl', code: CODE }).transportStatus).toBe(200);
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
