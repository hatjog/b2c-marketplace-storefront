import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { longContentFixture } from './fixtures/i18n-long-content.fixture';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const criticalSurfaces = [
  ['home', 'src/app/[locale]/(main)/page.tsx'],
  ['category-listing', 'src/app/[locale]/(main)/categories/page.tsx'],
  ['category-detail', 'src/app/[locale]/(main)/categories/[category]/page.tsx'],
  ['pdp', 'src/app/[locale]/(main)/products/[handle]/page.tsx'],
  ['cart', 'src/app/[locale]/(main)/cart/page.tsx'],
  ['checkout', 'src/app/[locale]/(checkout)/checkout/page.tsx'],
  ['payment-status', 'src/app/[locale]/(main)/order/[id]/payment-status/page.tsx'],
  ['confirmation-handoff', 'src/app/[locale]/(main)/order/[id]/confirmed/page.tsx'],
  ['account', 'src/app/[locale]/(main)/user/page.tsx'],
  ['account-recovery', 'src/app/[locale]/(auth)/forgot-password/page.tsx'],
  ['voucher-recovery', 'src/app/[locale]/(main)/user/recover/[token]/page.tsx'],
  ['password-reset', 'src/app/[locale]/(reset-password)/reset-password/page.tsx'],
  ['voucher-claim', 'src/app/[locale]/voucher/[code]/page.tsx'],
  ['seller-listing', 'src/app/[locale]/(main)/sellers/page.tsx'],
  ['seller-detail', 'src/app/[locale]/(main)/sellers/[handle]/page.tsx'],
  ['legal-regulamin', 'src/app/[locale]/(main)/regulamin/page.tsx'],
  ['legal-privacy', 'src/app/[locale]/(main)/polityka-prywatnosci/page.tsx'],
  ['legal-zasady', 'src/app/[locale]/(main)/zasady/page.tsx'],
  ['legal-help', 'src/app/[locale]/(main)/pomoc/page.tsx'],
] as const;

describe('Story 6.3 i18n long-content hardening', () => {
  it('commits realistic long-content fixtures for the required dimensions', () => {
    expect(longContentFixture.voucher.length).toBeGreaterThan(80);
    expect(longContentFixture.service_name.length).toBeGreaterThan(80);
    expect(longContentFixture.salon_name.length).toBeGreaterThan(80);
    expect(longContentFixture.price).toContain('199 999,99 zł');
    expect(longContentFixture.date).toContain('września');
    expect(longContentFixture.validation_message.length).toBeGreaterThan(90);
  });

  it.each(criticalSurfaces)('adds the long-content probe to %s', (surface, relativePath) => {
    const source = read(relativePath);

    expect(source).toContain('StorefrontI18nLongContentProbe');
    expect(source).toContain(`surface="${surface}"`);
  });

  it('keeps the probe machine-readable for downstream runtime checks', () => {
    const source = read(
      'src/components/atoms/StorefrontI18nLongContentProbe/StorefrontI18nLongContentProbe.tsx'
    );

    expect(source).toContain('data-testid="storefront-i18n-long-content-probe"');
    expect(source).toContain('data-locale={locale}');
    expect(source).toContain('data-surface={surface}');
    expect(source).toContain('data-overflow-strategy={overflowStrategy}');
    expect(source).toContain('hidden');
    expect(source).not.toContain('aria-live');
  });
});
