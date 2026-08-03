import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      qr_code_aria_label: 'Voucher QR code',
      qr_code_label: 'Scan at salon',
    };
    return map[key] ?? key;
  },
}));

// Mock as string — React treats it as intrinsic element; props are preserved on the element
vi.mock('qrcode.react', () => ({
  QRCodeSVG: 'qrcode-svg-mock',
}));

import { VoucherQrCode } from '../VoucherQrCode';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function findChild(
  element: ReactEl,
  predicate: (el: ReactEl) => boolean,
): ReactEl | null {
  const children = React.Children.toArray(element.props.children as React.ReactNode);
  for (const child of children) {
    if (!React.isValidElement<Record<string, unknown>>(child)) continue;
    const childElement = child as ReactEl;
    if (predicate(childElement)) return childElement;
    const found = findChild(childElement, predicate);
    if (found) return found;
  }
  return null;
}

function getQrElement(result: ReactEl): ReactEl | null {
  return findChild(result, (el) => el.type === 'qrcode-svg-mock');
}

describe('VoucherQrCode', () => {
  it('renders QR SVG when code is provided', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' });
    expect(result).not.toBeNull();
    const qr = getQrElement(result as ReactEl);
    expect(qr).not.toBeNull();
    expect(qr!.props.value).toBe('ABCD1234EFGH');
  });

  it('returns null when code is empty string', () => {
    const result = VoucherQrCode({ code: '' });
    expect(result).toBeNull();
  });

  it('returns null when code is only separators', () => {
    const result = VoucherQrCode({ code: '-- __. .' });
    expect(result).toBeNull();
  });

  it('normalizes input: lowercase + separators → uppercase clean', () => {
    const result = VoucherQrCode({ code: 'abcd-1234 efgh' }) as ReactEl;
    const qr = getQrElement(result)!;
    expect(qr.props.value).toBe('ABCD1234EFGH');
  });

  it('normalizes underscores and dots', () => {
    const result = VoucherQrCode({ code: 'abcd_1234.efgh' }) as ReactEl;
    const qr = getQrElement(result)!;
    expect(qr.props.value).toBe('ABCD1234EFGH');
  });

  it('passes default size 128 to QRCodeSVG', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' }) as ReactEl;
    const qr = getQrElement(result)!;
    expect(qr.props.size).toBe(128);
  });

  it('passes custom size to QRCodeSVG', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH', size: 256 }) as ReactEl;
    const qr = getQrElement(result)!;
    expect(qr.props.size).toBe(256);
  });

  it('clamps size to minimum 64', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH', size: 10 }) as ReactEl;
    const qr = getQrElement(result)!;
    expect(qr.props.size).toBe(64);
  });

  it('clamps size to maximum 512', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH', size: 2000 }) as ReactEl;
    const qr = getQrElement(result)!;
    expect(qr.props.size).toBe(512);
  });

  it('passes level M to QRCodeSVG', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' }) as ReactEl;
    const qr = getQrElement(result)!;
    expect(qr.props.level).toBe('M');
  });

  it('renders with default data-testid="qr-code"', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' }) as ReactEl;
    expect(result.props['data-testid']).toBe('qr-code');
  });

  it('accepts custom data-testid', () => {
    const result = VoucherQrCode({
      code: 'ABCD1234EFGH',
      'data-testid': 'custom-qr',
    }) as ReactEl;
    expect(result.props['data-testid']).toBe('custom-qr');
  });

  it('accepts custom className', () => {
    const result = VoucherQrCode({
      code: 'ABCD1234EFGH',
      className: 'my-class',
    }) as ReactEl;
    expect(result.props.className).toBe('my-class');
  });

  it('has role="img" for accessibility', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' }) as ReactEl;
    expect(result.props.role).toBe('img');
  });

  it('has aria-label for screen readers', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' }) as ReactEl;
    expect(result.props['aria-label']).toBe('Voucher QR code');
  });
});
