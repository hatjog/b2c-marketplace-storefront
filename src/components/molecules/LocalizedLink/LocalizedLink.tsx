'use client';

import React, { type MouseEventHandler } from 'react';

import Link from 'next/link';
import { useLocale } from 'next-intl';

import { isSupportedLocale } from '@/i18n/routing';

const ABSOLUTE_OR_SPECIAL_HREF = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i;

const getLocalizedHref = (href: string, locale: string) => {
  if (!href || ABSOLUTE_OR_SPECIAL_HREF.test(href) || href.startsWith('#')) {
    return href;
  }

  const match = href.match(/^([^?#]*)(.*)$/);
  const path = match?.[1] ?? href;
  const suffix = match?.[2] ?? '';

  if (!path || path === '/') {
    return `/${locale}${suffix}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const firstSegment = normalizedPath.split('/')[1];

  if (isSupportedLocale(firstSegment)) {
    return `${normalizedPath}${suffix}`;
  }

  return `/${locale}${normalizedPath}${suffix}`;
};

/**
 * Use this component to create a Next.js `<LocalizedClientLink />` that persists the current country code in the url,
 * without having to explicitly pass it as a prop.
 */
const LocalizedClientLink = ({
  children,
  href,
  locale,
  ...props
}: {
  children?: React.ReactNode;
  href: string;
  locale?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement> | undefined;
  passHref?: true;
  [x: string]: any;
}) => {
  const currentLocale = useLocale();
  const normalizedLocale = isSupportedLocale(locale ?? '') ? locale : currentLocale;

  return (
    <Link
      href={getLocalizedHref(href, normalizedLocale ?? currentLocale)}
      {...props}
    >
      {children}
    </Link>
  );
};

export default LocalizedClientLink;
