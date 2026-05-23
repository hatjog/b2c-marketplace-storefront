'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { ErrorSurface } from '@/components/templates/ErrorSurface';
import { buildTechnicalDetails, resolveRuntimeErrorVariant } from '@/lib/wave5/error-surface';

export default function MainErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations('wave5_errors');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const readOffline = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    readOffline();
    window.addEventListener('online', readOffline);
    window.addEventListener('offline', readOffline);
    return () => {
      window.removeEventListener('online', readOffline);
      window.removeEventListener('offline', readOffline);
    };
  }, []);

  const variant = resolveRuntimeErrorVariant(error, { offline });
  const details = buildTechnicalDetails(error, t(`runtime.${variant}.suggested_action`));

  return (
    <ErrorSurface
      data-testid="runtime-error-boundary"
      eyebrow={t(`runtime.${variant}.eyebrow`)}
      title={t(`runtime.${variant}.title`)}
      description={t(`runtime.${variant}.body`)}
      tone={variant === 'offline' ? 'warning' : 'error'}
      role={variant === 'offline' ? 'status' : 'alert'}
      primaryAction={
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-3 text-sm font-medium text-action-on-primary"
          data-testid="runtime-error-retry"
        >
          {t(`runtime.${variant}.primary_cta`)}
        </button>
      }
      utilityLink={
        <a
          href="https://status.bonbeauty.pl"
          className="inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-primary underline"
        >
          {t('runtime.status_link')}
        </a>
      }
      supportTitle={t('runtime.support_title')}
      supportPaths={[
        { id: 'self-service', label: t('runtime.support.self_service.label'), description: t('runtime.support.self_service.description') },
        { id: 'async', label: t('runtime.support.async.label'), description: t('runtime.support.async.description') },
        { id: 'panic', label: t('runtime.support.panic.label'), description: t('runtime.support.panic.description') },
      ]}
      technicalDetailsLabel={t('runtime.technical_details')}
      technicalDetails={details}
      secondaryAction={
        variant === 'offline' ? (
          <Link
            href={`/${locale}/pomoc`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-[rgba(113,88,40,0.16)] px-5 py-3 text-sm font-medium text-primary no-underline"
          >
            {t('runtime.offline.secondary_cta')}
          </Link>
        ) : undefined
      }
    />
  );
}
