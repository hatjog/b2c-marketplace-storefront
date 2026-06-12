import { describe, expect, it } from 'vitest';

import {
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
