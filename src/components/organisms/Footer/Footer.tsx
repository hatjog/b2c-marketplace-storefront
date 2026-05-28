import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  resolveFooterConnectLinks,
  resolveFooterCopyright,
  resolveFooterLegalEntity,
  resolveFooterNavLinks
} from '@/lib/footer';
import { loadLegalSignoffStatusMap } from '@/lib/legalSignoffStatus';
import type { MarketConfig } from '@/lib/portal';

const SECTION_I18N_KEYS: Record<string, string> = {
  customer_services: 'section_customer_services',
  about: 'section_about',
  connect: 'section_connect'
};

export async function Footer({
  marketConfig,
  locale
}: {
  marketConfig?: MarketConfig | null;
  locale: string;
}) {
  const t = await getTranslations('footer');
  const connectLinks = resolveFooterConnectLinks(marketConfig);
  const copyright = resolveFooterCopyright(marketConfig);
  const marketId = typeof marketConfig?.market_id === 'string' ? marketConfig.market_id : null;
  const legalSignoffStatus = marketId ? await loadLegalSignoffStatusMap(marketId, locale) : null;
  const navSections = resolveFooterNavLinks(marketConfig, legalSignoffStatus).filter(
    s => s.section !== 'connect'
  );
  const legalEntity = resolveFooterLegalEntity(marketConfig);

  const sectionLabel = (section: string) => {
    const key = SECTION_I18N_KEYS[section];
    return key
      ? t(key as 'section_customer_services' | 'section_about' | 'section_connect')
      : section;
  };

  return (
    <footer
      className="container bg-primary"
      data-testid="footer"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {navSections.map(({ section, links }) => (
          <div
            key={section}
            className="rounded-sm border p-6"
            data-testid={`footer-section-${section}`}
          >
            <h2 className="heading-sm mb-3 uppercase text-primary">{sectionLabel(section)}</h2>
            <nav
              className="space-y-3"
              aria-label={sectionLabel(section)}
            >
              {links.map(({ label, path, legalSignoffBadge }) => (
                <span
                  key={`${section}-${path}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <LocalizedClientLink
                    href={path}
                    locale={locale}
                    className="label-md block"
                    data-testid={`footer-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {label}
                  </LocalizedClientLink>
                  {legalSignoffBadge && (
                    <span
                      className="inline-flex max-w-full items-center rounded-sm border border-emerald-600/50 px-2 py-0.5 text-xs leading-tight text-emerald-700"
                      aria-label={t('legal_signoff_badge_aria')}
                      data-testid={`footer-legal-signoff-badge-${legalSignoffBadge.docType}`}
                    >
                      {t('legal_signoff_badge')}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>
        ))}

        {connectLinks.length > 0 && (
          <div
            className="rounded-sm border p-6"
            data-testid="footer-connect"
          >
            <h2 className="heading-sm mb-3 uppercase text-primary">{t('section_connect')}</h2>
            <nav
              className="space-y-3"
              aria-label={t('section_connect')}
            >
              {connectLinks.map(({ label, href }) => (
                <a
                  aria-label={t('go_to_social', { name: label })}
                  title={t('go_to_social', { name: label })}
                  key={href}
                  href={href}
                  className="label-md block"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`footer-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </div>

      {legalEntity && (
        <div
          className="rounded-sm border p-6"
          data-testid="footer-legal"
        >
          <h2 className="heading-sm mb-3 uppercase text-primary">{t('section_legal')}</h2>
          <address className="label-md space-y-1 not-italic text-secondary">
            <p data-testid="footer-legal-name">{legalEntity.name}</p>
            <p data-testid="footer-legal-tax-id">{legalEntity.tax_id}</p>
            <p data-testid="footer-legal-address">{legalEntity.address}</p>
            {legalEntity.email && (
              <p>
                <a
                  href={`mailto:${legalEntity.email}`}
                  data-testid="footer-legal-email"
                >
                  {legalEntity.email}
                </a>
              </p>
            )}
            {legalEntity.phone && (
              <p>
                <a
                  href={`tel:${legalEntity.phone}`}
                  data-testid="footer-legal-phone"
                >
                  {legalEntity.phone}
                </a>
              </p>
            )}
          </address>
        </div>
      )}

      <div
        className="rounded-sm border py-6"
        data-testid="footer-copyright"
      >
        <p className="text-md text-center text-secondary">{copyright}</p>
      </div>
    </footer>
  );
}
