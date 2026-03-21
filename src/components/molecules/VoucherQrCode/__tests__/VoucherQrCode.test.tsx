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

// Don't mock qrcode.react — inspect the element tree instead
vi.mock('qrcode.react', () => ({
  QRCodeSVG: 'QRCodeSVG', // renders as <QRCodeSVG> intrinsic element
}));

import { VoucherQrCode } from '../VoucherQrCode';

function findChild(
  element: React.ReactElement,
  predicate: (el: React.ReactElement) => boolean,
): React.ReactElement | null {
  const children = React.Children.toArray(element.props.children);
  for (const child of children) {
    if (!React.isValidElement(child)) continue;
    if (predicate(child)) return child;
    const found = findChild(child, predicate);
    if (found) return found;
  }
  return null;
}

function getQrElement(result: React.ReactElement): React.ReactElement | null {
  return findChild(result, (el) => el.type === 'QRCodeSVG');
}

describe('VoucherQrCode', () => {
  it('renders QR SVG when code is provided', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' });
    expect(result).not.toBeNull();
    const qr = getQrElement(result as React.ReactElement);
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
    const result = VoucherQrCode({ code: 'abcd-1234 efgh' }) as React.ReactElement;
    const qr = getQrElement(result)!;
    expect(qr.props.value).toBe('ABCD1234EFGH');
  });

  it('normalizes underscores and dots', () => {
    const result = VoucherQrCode({ code: 'abcd_1234.efgh' }) as React.ReactElement;
    const qr = getQrElement(result)!;
    expect(qr.props.value).toBe('ABCD1234EFGH');
  });

  it('passes default size 128 to QRCodeSVG', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' }) as React.ReactElement;
    const qr = getQrElement(result)!;
    expect(qr.props.size).toBe(128);
  });

  it('passes custom size to QRCodeSVG', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH', size: 256 }) as React.ReactElement;
    const qr = getQrElement(result)!;
    expect(qr.props.size).toBe(256);
  });

  it('passes level M to QRCodeSVG', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' }) as React.ReactElement;
    const qr = getQrElement(result)!;
    expect(qr.props.level).toBe('M');
  });

  it('renders with default data-testid="qr-code"', () => {
    const result = VoucherQrCode({ code: 'ABCD1234EFGH' }) as React.ReactElement;
    expect(result.props['data-testid']).toBe('qr-code');
  });

  it('accepts custom data-testid', () => {
    const result = VoucherQrCode({
      code: 'ABCD1234EFGH',
      'data-testid': 'custom-qr',
    }) as React.ReactElement;
    expect(result.props['data-testid']).toBe('custom-qr');
  });

  it('accepts custom className', () => {
    const result = VoucherQrCode({
      code: 'ABCD1234EFGH',
      className: 'my-class',
    }) as React.ReactElement;
    expect(result.props.className).toBe('my-class');
  });
});
