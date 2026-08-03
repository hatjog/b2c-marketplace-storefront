'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { IconButton } from '@/components/atoms';
import { HeaderCategoryNavbar } from '@/components/molecules';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { NAV_ITEMS } from '@/components/molecules/SiteNav/SiteNav';
import { CloseIcon, HamburgerMenuIcon } from '@/icons';

import { MobileCategoryNavbar } from './components';

export const MobileNavbar = ({
  categories,
  parentCategories
}: {
  categories: HttpTypes.StoreProductCategory[];
  parentCategories: HttpTypes.StoreProductCategory[];
}) => {
  const t = useTranslations('navigation');
  const tNav = useTranslations('header.nav');
  const [isOpen, setIsOpen] = useState(false);

  const closeMenuHandler = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div
      className="lg:hidden"
      data-testid="mobile-navbar"
    >
      <div
        onClick={() => setIsOpen(true)}
        data-testid="mobile-menu-toggle"
      >
        <HamburgerMenuIcon />
      </div>
      {isOpen && (
        <div
          className="bb-chrome-drawer"
          data-testid="mobile-menu-drawer"
        >
          <div
            className="flex items-center justify-between border-b border-[var(--bb-border-soft)] bg-[var(--bb-surface-96)] p-4"
            data-testid="mobile-menu-header"
          >
            <h2 className="heading-md uppercase text-primary">{t('menu')}</h2>
            <IconButton
              icon={<CloseIcon size={20} />}
              onClick={() => closeMenuHandler()}
              variant="icon"
              size="small"
              data-testid="mobile-menu-close-button"
            />
          </div>
          <div className="">
            {/* Primary site nav (W6-01 contract-A parity) — same items as the
                desktop SiteNav, surfaced at the top of the mobile drawer. */}
            <nav
              className="flex flex-col border-b border-[var(--bb-border-soft)] bg-[var(--bb-surface)]"
              aria-label="BonBeauty"
              data-testid="mobile-site-nav"
            >
              {NAV_ITEMS.map(({ key, href }) => (
                <LocalizedClientLink
                  key={key}
                  href={href}
                  onClick={closeMenuHandler}
                  data-testid={`mobile-site-nav-${key}`}
                  className="border-b border-[var(--bb-border-hairline)] px-4 py-3 text-base text-[var(--text-primary)] last:border-b-0 hover:bg-[var(--bb-surface-muted)]"
                >
                  {tNav(key)}
                </LocalizedClientLink>
              ))}
            </nav>
            <HeaderCategoryNavbar
              onClose={closeMenuHandler}
              categories={categories}
              parentCategories={parentCategories}
            />
            <div className="p-4">
              <MobileCategoryNavbar
                onClose={closeMenuHandler}
                categories={categories}
                parentCategories={parentCategories}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
