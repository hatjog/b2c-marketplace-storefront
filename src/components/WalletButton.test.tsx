import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  getWalletButtonCopy,
  getWalletEndpoint,
  requestWalletSave,
} from './WalletButton';
import {
  getEmailResendEndpoint,
  getPossessionCopy,
  isIphoneSafari,
  shouldRenderAppleWallet,
  SymmetricPossessionSection,
} from './voucher-possession/SymmetricPossessionSection';

describe('WalletButton — recipient view', () => {
  it('builds the storefront wallet endpoint from the voucher code', () => {
    expect(getWalletEndpoint('AB CD/12')).toBe('/store/voucher/AB%20CD%2F12/wallet');
  });

  it('posts provider-neutral payload and returns Google Wallet save URL', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ saveUrl: 'https://pay.google.com/gp/v/save/jwt-123' }),
    });

    await expect(
      requestWalletSave({
        voucherCode: 'ABC12345',
        provider: 'google',
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ saveUrl: 'https://pay.google.com/gp/v/save/jwt-123' });

    expect(fetcher).toHaveBeenCalledWith(
      '/store/voucher/ABC12345/wallet',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'google' }),
      }),
    );
  });

  it('detects iPhone Safari and hides Apple Wallet while preserving Google Wallet', () => {
    const safariUa =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1';

    expect(isIphoneSafari(safariUa)).toBe(true);
    expect(
      shouldRenderAppleWallet({
        provider: 'apple',
        appleWalletEnabled: false,
        userAgent: safariUa,
      }),
    ).toBe(false);
    expect(shouldRenderAppleWallet({ provider: 'google', userAgent: safariUa })).toBe(true);
  });

  it('has 4-locale labels for wallet and possession copy without PL bleed', () => {
    expect(getWalletButtonCopy('pl', 'google').label).toBe('Dodaj do Google Wallet');
    expect(getWalletButtonCopy('en', 'google').label).toBe('Add to Google Wallet');
    expect(getWalletButtonCopy('de', 'google').label).toBe('Zu Google Wallet hinzufügen');
    expect(getWalletButtonCopy('ua', 'google').label).toBe('Додати до Google Wallet');
    expect(getPossessionCopy('en').eyebrow).toContain('phone');
    expect(getPossessionCopy('de').eyebrow).toContain('Telefon');
  });

  it('renders three equal-weight CTAs in wallet -> PDF -> email DOM order and uses h2 heading', () => {
    const html = renderToStaticMarkup(
      <SymmetricPossessionSection
        voucherCode="ABC12345"
        locale="pl"
        pdfHref="/api/voucher/ABC12345/pdf"
      />,
    );

    const wallet = html.indexOf('Dodaj do Google Wallet');
    const pdf = html.indexOf('Pobierz PDF');
    const email = html.indexOf('Wyślij ponownie na e-mail');

    expect(wallet).toBeGreaterThan(-1);
    expect(pdf).toBeGreaterThan(wallet);
    expect(email).toBeGreaterThan(pdf);
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Dodaj voucher do Google Wallet"');
    expect(html).toContain('aria-label="Pobierz voucher jako PDF"');
    expect(html).toContain('aria-label="Wyślij voucher ponownie na e-mail"');
    // F-07: heading element for screen reader rotor navigation.
    expect(html).toContain('<h2 id="voucher-possession-heading"');
    // F-08: eyebrow stays neutral (no Apple-soon copy contradicting active Google CTA).
    expect(html).not.toContain('Apple Wallet wkrótce');
  });

  it('rejects a non-Google save URL only when provider=google (F-02)', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ saveUrl: 'https://example.com/not-google' }),
    });

    await expect(
      requestWalletSave({
        voucherCode: 'ABC12345',
        provider: 'google',
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Google Wallet/);

    await expect(
      requestWalletSave({
        voucherCode: 'ABC12345',
        provider: 'apple',
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ saveUrl: 'https://example.com/not-google' });
  });

  it('builds email resend endpoint without promoting PDF as a fallback', () => {
    expect(getEmailResendEndpoint('ABC12345')).toBe('/store/voucher/ABC12345/email');
    expect(getPossessionCopy('pl').eyebrow).toBe(
      'Zachowaj voucher jak chcesz — w telefonie, w PDF, lub w mailu',
    );
  });
});
