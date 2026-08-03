import { describe, expect, it, vi } from 'vitest';

import { createRawKeyGuard } from './rawKeyGuard';

describe('raw-key i18n runtime guard', () => {
  it('returns configured fallback copy instead of rendering a raw key', () => {
    const guard = createRawKeyGuard({
      environment: 'production',
      fallbacks: [{ cart: { empty_title: 'Your cart is empty' } }],
    });

    expect(guard.getMessageFallback({ namespace: 'cart', key: 'empty_title' })).toBe('Your cart is empty');
  });

  it('does not duplicate namespace when next-intl passes a full dotted key', () => {
    const guard = createRawKeyGuard({
      environment: 'production',
      fallbacks: [{ cart: { empty_title: 'Your cart is empty' } }],
    });

    expect(guard.getMessageFallback({ namespace: 'cart', key: 'cart.empty_title' })).toBe('Your cart is empty');
  });

  it('fails loud in test/dev when no catalog can resolve the missing key', () => {
    const guard = createRawKeyGuard({
      environment: 'test',
      fallbacks: [{ cart: {} }],
    });

    expect(() => guard.getMessageFallback({ namespace: 'cart', key: 'empty_title' })).toThrow(
      'cart.empty_title'
    );
  });

  it('does not render raw keys in production when a missing message reaches fallback handling', () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const guard = createRawKeyGuard({
      environment: 'production',
      fallbacks: [{ cart: {} }],
      logger,
    });

    expect(guard.getMessageFallback({ namespace: 'cart', key: 'empty_title' })).toBe('');
    expect(logger.error).toHaveBeenCalledWith('[i18n] Missing message fallback for "cart.empty_title"');
  });

  it('turns next-intl missing-message errors into test/dev failures', () => {
    const guard = createRawKeyGuard({
      environment: 'test',
      fallbacks: [{}],
    });

    expect(() =>
      guard.onError({ code: 'MISSING_MESSAGE', message: 'Missing message: cart.empty_title' })
    ).toThrow('cart.empty_title');
  });
});
