'use client';

import { useTranslations } from 'next-intl';

const BONBEAUTY_CONTACT_HREF = '/contact';

function isSafePhone(phone: string): boolean {
  return /^[+\d\s\-().]+$/.test(phone);
}

function isSafeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface SellerContactProps {
  phone?: string | null;
  email?: string | null;
}

export function SellerContact({ phone, email }: SellerContactProps) {
  const t = useTranslations('seller.contact');
  const safePhone = phone && isSafePhone(phone) ? phone : null;
  const safeEmail = email && isSafeEmail(email) ? email : null;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
      {safePhone && (
        <a
          href={`tel:${safePhone}`}
          className="hover:text-gray-900 transition-colors"
          aria-label={t('call_aria', { phone: safePhone })}
        >
          {safePhone}
        </a>
      )}
      {safeEmail && (
        <a
          href={`mailto:${safeEmail}`}
          className="hover:text-gray-900 transition-colors"
          aria-label={t('email_aria', { email: safeEmail })}
        >
          {safeEmail}
        </a>
      )}
      {!safePhone && !safeEmail && (
        <span>
          {t('fallback_prefix')}{' '}
          <a
            href={BONBEAUTY_CONTACT_HREF}
            className="underline hover:no-underline"
          >
            {t('fallback_cta')}
          </a>
        </span>
      )}
    </div>
  );
}
