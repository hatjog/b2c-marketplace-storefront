import { describe, expect, it } from 'vitest';

import {
  resolveConfirmationHeroTone,
  resolveGiftCue,
  resolveGiftMessage,
  resolveVoucherRuleBadges,
  resolveVoucherThumbnail
} from '../order-confirmed-surface';

describe('order-confirmed-surface', () => {
  it('reads sender gift message from Story 5.3 line-item metadata', () => {
    expect(
      resolveGiftMessage([
        {
          title: 'Voucher',
          metadata: {
            gift_recipient_message: 'Wszystkiego najlepszego, Mario!'
          }
        }
      ])
    ).toBe('Wszystkiego najlepszego, Mario!');
  });

  it('keeps gift-cue visible but message-empty when binding is not hydrated', () => {
    expect(
      resolveGiftCue(true, 'm***a@example.com', [
        {
          title: 'Voucher',
          metadata: {
            gift_recipient_email: 'maria@example.com'
          }
        }
      ])
    ).toEqual({
      recipient: 'm***a@example.com',
      message: null
    });
  });

  it('does not render gift-cue for self purchase', () => {
    expect(resolveGiftCue(false, 'buyer@example.com', [])).toBeNull();
  });

  it('resolves voucher thumbnails and badge copy from direct or gp metadata', () => {
    const item = {
      title: 'Rytuał spa',
      thumbnail: null,
      metadata: {
        gp: {
          validity_period: 'Ważny do 31.12.2026',
          refund_policy: '30 dni zwrot',
          voucher_thumbnail: '/images/voucher.jpg'
        }
      }
    };

    expect(resolveVoucherThumbnail(item)).toBe('/images/voucher.jpg');
    expect(resolveVoucherRuleBadges(item, '30 dni zwrot')).toEqual({
      validity: 'Ważny do 31.12.2026',
      refund: '30 dni zwrot'
    });
  });
});

// ── review-fix MEDIUM-1 ─────────────────────────────────────────────────────
//
// Nagłówek strony renderował „✓ Zamówienie potwierdzone" BEZWARUNKOWO — także
// gdy jedyna karta była w stanie `payment_failed` z tekstem „Zamówienie nie
// zostało opłacone". Ten test pęka po cofnięciu agregatu do stałej `success`.
describe('resolveConfirmationHeroTone — nagłówek nie ogłasza sukcesu nad porażką', () => {
  it('wszystkie zamówienia terminalnie nieudane → nagłówek PORAŻKI', () => {
    expect(resolveConfirmationHeroTone(['a', 'b'], { a: 'failed', b: 'failed' })).toBe('failure');
  });

  it('część nieudana → nagłówek CZĘŚCIOWY, nie sukces i nie porażka', () => {
    expect(resolveConfirmationHeroTone(['a', 'b'], { a: 'failed', b: 'success' })).toBe('partial');
  });

  it('karta jeszcze nieraportująca jest `pending` — nagłówek porażki NIE miga', () => {
    expect(resolveConfirmationHeroTone(['a', 'b'], { a: 'failed' })).toBe('partial');
    expect(resolveConfirmationHeroTone(['a', 'b'], {})).toBe('success');
  });

  it('sam sukces zostaje sukcesem', () => {
    expect(resolveConfirmationHeroTone(['a'], { a: 'success' })).toBe('success');
  });

  it('awaria ODCZYTU daje ton zdegradowany, nigdy domenowy werdykt porażki', () => {
    expect(resolveConfirmationHeroTone(['a'], { a: 'read_failed' })).toBe('degraded');
    expect(resolveConfirmationHeroTone(['a', 'b'], { a: 'read_failed', b: 'success' })).toBe(
      'degraded'
    );
  });
});
