import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import de from '../../../../../messages/de.json';
import en from '../../../../../messages/en.json';
import pl from '../../../../../messages/pl.json';
import ua from '../../../../../messages/ua.json';

const messages = { de, en, pl, ua };

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale }: { locale: keyof typeof messages }) => (key: string) => {
    const [group, field] = key.split('.');
    const value = messages[locale].payment_status[
      group as keyof (typeof messages)[typeof locale]['payment_status']
    ] as { label?: string; body?: string; cta?: string };
    return value?.[field as keyof typeof value] ?? '';
  }
}));

const { PaymentReturnNotice } = await import('../PaymentReturnNotice');

describe('PaymentReturnNotice — recovery jest widoczne we wszystkich locale', () => {
  it.each([
    ['bridge_read_failed', 'read_failed'],
    ['bridge_access_denied', 'access_denied'],
    ['incomplete_order_set', 'incomplete']
  ] as const)('renderuje %s jako alert z jednym CTA w pl/en/de/ua', async (reason, _caseName) => {
    for (const locale of ['pl', 'en', 'de', 'ua'] as const) {
      const element = await PaymentReturnNotice({
        locale,
        result: { state: 'recovery_required', reason },
        cartHref: `/${locale}/cart`
      });
      const html = renderToStaticMarkup(element);
      const copy = messages[locale].payment_status.return_recovery_required;

      expect(html).toContain('role="alert"');
      expect(html).toContain(`data-return-reason="${reason}"`);
      expect(html).toContain(copy.label);
      expect(html).toContain(copy.body);
      expect(html).toContain(copy.cta);
      expect(html.match(/<a\b/g)).toHaveLength(1);
      expect(html).toContain(`href="/${locale}/cart"`);
    }
  });
});
