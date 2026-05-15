// @chrome-manifest: W6-02
// SiteFooter — Wave 6 chrome W6-02. v1.8.0 BonBeauty DS site-footer.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/site-footer.yaml
// slot: legal-entity — dane prawne sprzedawcy NIP/REGON/KRS placeholder
// Variants: desktop (grid) / mobile-accordion (stacked)

import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  resolveFooterConnectLinks,
  resolveFooterCopyright,
  resolveFooterLegalEntity,
  resolveFooterNavLinks,
} from '@/lib/footer';
import type { MarketConfig } from '@/lib/portal';

const SECTION_I18N_KEYS: Record<string, string> = {
  customer_services: 'section_customer_services',
  about: 'section_about',
  connect: 'section_connect',
};

export async function SiteFooter({
  marketConfig,
  locale,
}: {
  marketConfig?: MarketConfig | null;
  locale: string;
}) {
  const t = await getTranslations('footer');
  const connectLinks = resolveFooterConnectLinks(marketConfig);
  const copyright = resolveFooterCopyright(marketConfig);
  const navSections = resolveFooterNavLinks(marketConfig).filter((s) => s.section !== 'connect');
  const legalEntity = resolveFooterLegalEntity(marketConfig);

  const sectionLabel = (section: string) => {
    const key = SECTION_I18N_KEYS[section];
    return key
      ? t(key as 'section_customer_services' | 'section_about' | 'section_connect')
      : section;
  };

  return (
    <footer
      className="bg-[var(--bb-surface-dark)] text-[color:rgba(250,248,245,0.8)]"
      data-testid="site-footer"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
        {/* W6-02 variant: desktop — grid layout */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Logo + tagline column */}
          <div className="space-y-3">
            <LocalizedClientLink href="/" className="text-xl font-semibold text-white" aria-label="BonBeauty home">
              BonBeauty
            </LocalizedClientLink>
            <p className="text-sm leading-relaxed text-[color:rgba(250,248,245,0.6)]">
              Marketplace premium salonów beauty
            </p>
          </div>

          {/* Nav sections */}
          {navSections.slice(0, 2).map(({ section, links }) => (
            <div key={section} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:rgba(250,248,245,0.6)]">
                {sectionLabel(section)}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <LocalizedClientLink
                      href={link.href}
                      className="text-sm text-[color:rgba(250,248,245,0.75)] transition-colors hover:text-white"
                    >
                      {link.label}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Connect column */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:rgba(250,248,245,0.6)]">
              {t('section_connect')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {connectLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[color:rgba(250,248,245,0.75)] transition-colors hover:text-white"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-10 border-t border-[color:rgba(250,248,245,0.12)] pt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            {/* Copyright */}
            <p className="text-xs text-[color:rgba(250,248,245,0.5)]">{copyright}</p>

            {/* slot: legal-entity — dane prawne sprzedawcy NIP/REGON/KRS (W6-02 spec) */}
            {legalEntity && (
              <div
                className="space-y-0.5 text-xs text-[color:rgba(250,248,245,0.45)]"
                data-testid="site-footer-legal-entity"
              >
                {legalEntity.companyName && <p>{legalEntity.companyName}</p>}
                {legalEntity.nip && <p>NIP: {legalEntity.nip}</p>}
                {legalEntity.regon && <p>REGON: {legalEntity.regon}</p>}
                {legalEntity.krs && <p>KRS: {legalEntity.krs}</p>}
                {legalEntity.address && <p>{legalEntity.address}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
