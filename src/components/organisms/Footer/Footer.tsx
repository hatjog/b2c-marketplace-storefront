import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { resolveFooterConnectLinks, resolveFooterCopyright, resolveFooterNavLinks } from '@/lib/footer';
import type { MarketConfig } from '@/lib/portal';

const SECTION_I18N_KEYS: Record<string, string> = {
  customer_services: 'section_customer_services',
  about: 'section_about',
  connect: 'section_connect'
};

export async function Footer({ marketConfig }: { marketConfig?: MarketConfig | null } = {}) {
  const t = await getTranslations('footer');
  const connectLinks = resolveFooterConnectLinks(marketConfig);
  const copyright = resolveFooterCopyright(marketConfig);
  const navSections = resolveFooterNavLinks(marketConfig).filter(s => s.section !== 'connect');

  const sectionLabel = (section: string) => {
    const key = SECTION_I18N_KEYS[section];
    return key ? t(key as 'section_customer_services' | 'section_about' | 'section_connect') : section;
  };

  return (
    <footer
      className="container bg-primary"
      data-testid="footer"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {navSections.map(({ section, links }) => (
          <div
            key={section}
            className="rounded-sm border p-6"
            data-testid={`footer-section-${section}`}
          >
            <h2 className="heading-sm mb-3 uppercase text-primary">
              {sectionLabel(section)}
            </h2>
            <nav
              className="space-y-3"
              aria-label={sectionLabel(section)}
            >
              {links.map(({ label, path }) => (
                <LocalizedClientLink
                  key={label}
                  href={path}
                  className="label-md block"
                  data-testid={`footer-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {label}
                </LocalizedClientLink>
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
                  key={label}
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

      <div
        className="rounded-sm border py-6"
        data-testid="footer-copyright"
      >
        <p className="text-md text-center text-secondary">{copyright}</p>
      </div>
    </footer>
  );
}
