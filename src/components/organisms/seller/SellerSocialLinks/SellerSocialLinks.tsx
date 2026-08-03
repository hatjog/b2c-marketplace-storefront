'use client';

import { useTranslations } from 'next-intl';

import { EarthIcon, FacebookIcon, InstagramIcon } from '@/icons';
import type { SellerSocialLinks as SocialLinksType } from '@/types/seller';

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function TikTokIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
}

export interface SellerSocialLinksProps {
  socialLinks?: SocialLinksType | null;
}

export function SellerSocialLinks({ socialLinks }: SellerSocialLinksProps) {
  const t = useTranslations('seller.social_links');

  if (!socialLinks) return null;

  const { instagram, facebook, tiktok, website } = socialLinks;

  const safeInstagram = instagram && isSafeUrl(instagram) ? instagram : null;
  const safeFacebook = facebook && isSafeUrl(facebook) ? facebook : null;
  const safeTiktok = tiktok && isSafeUrl(tiktok) ? tiktok : null;
  const safeWebsite = website && isSafeUrl(website) ? website : null;

  if (!safeInstagram && !safeFacebook && !safeTiktok && !safeWebsite) return null;

  return (
    <nav aria-label={t('aria_label')} className="flex items-center gap-3" data-testid="seller-social-links">
      {safeInstagram && (
        <a
          href={safeInstagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('instagram_aria')}
          className="text-gray-500 hover:text-gray-900 transition-colors"
        >
          <InstagramIcon size={20} />
        </a>
      )}
      {safeFacebook && (
        <a
          href={safeFacebook}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('facebook_aria')}
          className="text-gray-500 hover:text-gray-900 transition-colors"
        >
          <FacebookIcon size={20} />
        </a>
      )}
      {safeTiktok && (
        <a
          href={safeTiktok}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('tiktok_aria')}
          className="text-gray-500 hover:text-gray-900 transition-colors"
        >
          <TikTokIcon size={20} />
        </a>
      )}
      {safeWebsite && (
        <a
          href={safeWebsite}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('website_aria')}
          className="text-gray-500 hover:text-gray-900 transition-colors"
        >
          <EarthIcon size={20} />
        </a>
      )}
    </nav>
  );
}
