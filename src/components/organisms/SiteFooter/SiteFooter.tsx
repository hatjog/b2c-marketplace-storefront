// @chrome-manifest: W6-02
// SiteFooter — Wave 6 chrome W6-02. v1.8.0 BonBeauty DS site-footer.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/site-footer.yaml
// slot: legal-entity — dane prawne sprzedawcy NIP/REGON/KRS placeholder
// Variants: desktop (grid) / mobile-accordion (stacked)

import { getTranslations } from 'next-intl/server';

import { LogoLockup } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  resolveFooterConnectLinks,
  resolveFooterCopyright,
  resolveFooterLegalEntity,
  resolveFooterNavLinks
} from '@/lib/footer';
import { toHreflang } from '@/lib/helpers/hreflang';
import { loadLegalSignoffStatusMap } from '@/lib/legalSignoffStatus';
import type { MarketConfig } from '@/lib/portal';

const SECTION_I18N_KEYS: Record<string, string> = {
  customer_services: 'section_customer_services',
  about: 'section_about',
  connect: 'section_connect'
};

type FooterNavMessageKey =
  | 'nav.about'
  | 'nav.faq'
  | 'nav.kontakt'
  | 'nav.regulamin'
  | 'nav.polityka-prywatnosci'
  | 'nav.pomoc'
  | 'nav.zasady';

export async function SiteFooter({
  marketConfig,
  locale
}: {
  marketConfig?: MarketConfig | null;
  locale: string;
}) {
  // QD-03 (CAP-3): jawne locale — to samo, które idzie do
  // `loadLegalSignoffStatusMap(marketId, locale)` niżej. Zakres treści footera
  // (etykiety, copyright z market config) pozostaje w QD-02; tu zmienia się
  // wyłącznie sposób rozstrzygania locale dla `messages/*.json`.
  const t = await getTranslations({ locale, namespace: 'footer' });
  // QD-02: notice fallbacku jest chrome w locale TRASY, więc korzysta z tego
  // samego jawnego locale co `t` powyżej.
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const connectLinks = resolveFooterConnectLinks(marketConfig);
  const copyright = resolveFooterCopyright(marketConfig);
  const copyrightFallback = marketConfig?.footer?.copyright_fallback ?? null;
  const copyrightFallbackTag = copyrightFallback ? toHreflang(copyrightFallback.locale) : null;
  const marketId = typeof marketConfig?.market_id === 'string' ? marketConfig.market_id : null;
  const legalSignoffStatus = marketId ? await loadLegalSignoffStatusMap(marketId, locale) : null;
  const translateFooterNavLabel = (key: string) => {
    const footerKey = key as FooterNavMessageKey;
    return t.has(footerKey) ? t(footerKey) : null;
  };
  const navSections = resolveFooterNavLinks(
    marketConfig,
    legalSignoffStatus,
    translateFooterNavLabel
  ).filter(
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
      className="bg-[var(--bb-surface-dark)] text-[var(--bb-cream-75)]"
      data-testid="site-footer"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
        {/* W6-02 variant: desktop — grid layout */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Logo + tagline column */}
          <div className="space-y-3">
            <LogoLockup
              variant="light"
              className="text-white"
              imageClassName="h-8"
              wordmarkClassName="text-white"
              data-testid="site-footer-logo"
            />
            <p className="text-sm leading-relaxed text-[var(--bb-cream-60)]">
              {t('tagline')}
            </p>
          </div>

          {/* Nav sections */}
          {navSections.slice(0, 2).map(({ section, links }) => (
            <div
              key={section}
              className="space-y-3"
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--bb-cream-60)]">
                {sectionLabel(section)}
              </h2>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.path}>
                    <span className="flex flex-wrap items-center gap-2">
                      <LocalizedClientLink
                        href={link.path}
                        className="text-sm text-[var(--bb-cream-75)] transition-colors hover:text-white"
                      >
                        {link.label}
                      </LocalizedClientLink>
                      {link.legalSignoffBadge && (
                        <span
                          className="inline-flex max-w-full items-center rounded-sm border border-emerald-300/40 px-2 py-0.5 text-xs leading-tight text-emerald-100"
                          aria-label={t('legal_signoff_badge_aria')}
                          data-testid={`site-footer-legal-signoff-badge-${link.legalSignoffBadge.docType}`}
                        >
                          {t('legal_signoff_badge')}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Connect column */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--bb-cream-60)]">
              {t('section_connect')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {connectLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[var(--bb-cream-75)] transition-colors hover:text-white"
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
        <div className="mt-10 border-t border-[var(--bb-tint-gold-12)] pt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            {/* Copyright. QD-02: `lang` marks the fallback ONLY when the copy
                really came from another locale. `copyright` is one field in one
                element, so a fallback is always whole and `lang` never mislabels
                a correctly translated sibling (QD-01 change log, party PR-2). */}
            <div className="text-xs text-[var(--bb-muted-72)]">
              <p
                data-testid="site-footer-copyright"
                {...(copyrightFallbackTag
                  ? { lang: copyrightFallbackTag, 'data-locale-fallback': copyrightFallbackTag }
                  : {})}
              >
                {copyright}
              </p>
              {copyrightFallbackTag && (
                <p role="status">
                  {tCommon('locale_fallback_notice', { locale: copyrightFallbackTag })}
                </p>
              )}
            </div>

            {/* slot: legal-entity — dane prawne sprzedawcy NIP/REGON/KRS (W6-02 spec) */}
            {legalEntity && (
              <div
                className="space-y-0.5 text-xs text-[var(--bb-muted-72)]"
                data-testid="site-footer-legal-entity"
              >
                {/* QD-07: nazwa podmiotu dostaje wlasny testid. e2e-16 asertowal
                    `footer-legal-name`, ktorego SiteFooter nigdy nie emitowal, wiec
                    asercja skipowala sie w nieskonczonosc i raportowala zielen. */}
                {legalEntity.name && <p data-testid="site-footer-legal-name">{legalEntity.name}</p>}
                {/* QD-02: the tax-ID VALUE is a non-localized fact, but its LABEL
                    is chrome — "NIP:" was rendering verbatim on /en, /ua and /de. */}
                {legalEntity.tax_id && (
                  <p>
                    {t('tax_id_label')} {legalEntity.tax_id}
                  </p>
                )}
                {legalEntity.address && <p>{legalEntity.address}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
