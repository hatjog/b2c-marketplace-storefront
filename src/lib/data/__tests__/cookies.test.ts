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

const { getPaymentReturnOutcome, setCartId, setPaymentReturnOutcome } = await import('../cookies');

beforeEach(() => {
  values.clear();
  set.mockClear();
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
});
