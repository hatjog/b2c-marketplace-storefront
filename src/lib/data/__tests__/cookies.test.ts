import { beforeEach, describe, expect, it, vi } from 'vitest';

const values = new Map<string, string>();
const set = vi.fn((name: string, value: string) => values.set(name, value));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (values.has(name) ? { name, value: values.get(name) } : undefined),
    set
  })
}));

vi.mock('@/lib/sdk/locale-interceptor', () => ({
  resolveStorefrontLocale: vi.fn(async () => 'pl')
}));

process.env.GP_VOUCHER_CLAIM_HMAC_SECRET = 'payment-return-cookie-test-secret-32-bytes';

const {
  getPaymentReturnOutcome,
  getPaymentReturnOutcomeStorageState,
  setCartId,
  setPaymentReturnOutcome
} = await import('../cookies');

beforeEach(() => {
  values.clear();
  set.mockClear();
  process.env.GP_VOUCHER_CLAIM_HMAC_SECRET = 'payment-return-cookie-test-secret-32-bytes';
  delete process.env.JWT_SECRET;
});

describe('cookies powrotu płatności', () => {
  it('wysyła dowód koszyka podczas top-level return z 3DS, ale nie luzuje go do `none`', async () => {
    await setCartId('cart_01PAYMENTRETURN');

    expect(set).toHaveBeenCalledWith(
      '_medusa_cart_id',
      'cart_01PAYMENTRETURN',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    );
  });

  it('odrzuca podmieniony outcome, więc cookie nie jest bramką dającą się sfałszować', async () => {
    await setPaymentReturnOutcome({
      identifier: 'cart_01PAYMENTRETURN',
      paymentIntent: 'pi_01PAYMENTRETURN',
      outcome: 'completion_failed'
    });
    const cookie = values.get('_gp_payment_return_outcome');
    expect(cookie).toBeTruthy();

    const forged = JSON.parse(cookie as string) as { records: Array<{ outcome: string }> };
    forged.records[0].outcome = 'done';
    values.set('_gp_payment_return_outcome', JSON.stringify(forged));

    await expect(
      getPaymentReturnOutcome('cart_01PAYMENTRETURN', 'pi_01PAYMENTRETURN')
    ).resolves.toBeNull();
  });

  it('używa niepustego JWT_SECRET, gdy dedykowany sekret jest pusty', async () => {
    process.env.GP_VOUCHER_CLAIM_HMAC_SECRET = '';
    process.env.JWT_SECRET = 'payment-return-jwt-fallback-test-secret';

    await expect(
      setPaymentReturnOutcome({
        identifier: 'cart_01PAYMENTRETURN',
        paymentIntent: 'pi_01PAYMENTRETURN',
        outcome: 'completion_failed'
      })
    ).resolves.toBe('ready');
    await expect(
      getPaymentReturnOutcome('cart_01PAYMENTRETURN', 'pi_01PAYMENTRETURN')
    ).resolves.toBe('completion_failed');
  });

  it('odmawia zapisu outcome bez obu sekretów zamiast tworzyć niepodpisaną bramkę', async () => {
    process.env.GP_VOUCHER_CLAIM_HMAC_SECRET = '';
    delete process.env.JWT_SECRET;

    await expect(
      getPaymentReturnOutcomeStorageState('cart_01PAYMENTRETURN', 'pi_01PAYMENTRETURN')
    ).resolves.toBe('secret_unavailable');
    await expect(
      setPaymentReturnOutcome({
        identifier: 'cart_01PAYMENTRETURN',
        paymentIntent: 'pi_01PAYMENTRETURN',
        outcome: 'completion_failed'
      })
    ).resolves.toBe('secret_unavailable');
    expect(values.get('_gp_payment_return_outcome')).toBeUndefined();
  });

  it('nie wypycha najstarszego outcome przy czwartym tuple', async () => {
    const tuples = [
      ['cart_01PAYMENTRETURNA', 'pi_01PAYMENTRETURNA'],
      ['cart_01PAYMENTRETURNB', 'pi_01PAYMENTRETURNB'],
      ['cart_01PAYMENTRETURNC', 'pi_01PAYMENTRETURNC']
    ] as const;

    for (const [identifier, paymentIntent] of tuples) {
      await expect(
        setPaymentReturnOutcome({ identifier, paymentIntent, outcome: 'completion_failed' })
      ).resolves.toBe('ready');
    }

    await expect(
      getPaymentReturnOutcomeStorageState('cart_01PAYMENTRETURND', 'pi_01PAYMENTRETURND')
    ).resolves.toBe('capacity_exhausted');
    await expect(
      setPaymentReturnOutcome({
        identifier: 'cart_01PAYMENTRETURND',
        paymentIntent: 'pi_01PAYMENTRETURND',
        outcome: 'completion_failed'
      })
    ).resolves.toBe('capacity_exhausted');
    await expect(getPaymentReturnOutcome(...tuples[0])).resolves.toBe('completion_failed');
    expect(
      (JSON.parse(values.get('_gp_payment_return_outcome') as string) as { records: unknown[] })
        .records
    ).toHaveLength(3);
  });
});

describe('Story 8.2 (DW-15-295) — monotoniczność wyniku terminalnego', () => {
  const identifier = 'cart_01STORY82MONO';
  const paymentIntent = 'pi_01STORY82MONO';

  it.each([
    'completion_read_failed',
    'completion_access_denied',
    'no_order_id',
    'completion_failed',
    'done',
    'cart_unavailable'
  ])('terminalny `%s` nie zostaje nadpisany nieterminalnym `read_failed`', async terminal => {
    await setPaymentReturnOutcome({ identifier, paymentIntent, outcome: terminal });
    await setPaymentReturnOutcome({
      identifier,
      paymentIntent,
      outcome: 'read_failed',
      ttlSeconds: 60
    });
    await setPaymentReturnOutcome({
      identifier,
      paymentIntent,
      outcome: 'payment_not_terminal',
      ttlSeconds: 60
    });
    await expect(getPaymentReturnOutcome(identifier, paymentIntent)).resolves.toBe(terminal);
  });

  it('nieterminalny marker ustępuje terminalnemu (kierunek dozwolony)', async () => {
    await setPaymentReturnOutcome({
      identifier,
      paymentIntent,
      outcome: 'read_failed',
      ttlSeconds: 60
    });
    await setPaymentReturnOutcome({ identifier, paymentIntent, outcome: 'completion_read_failed' });
    await expect(getPaymentReturnOutcome(identifier, paymentIntent)).resolves.toBe(
      'completion_read_failed'
    );
  });
});
