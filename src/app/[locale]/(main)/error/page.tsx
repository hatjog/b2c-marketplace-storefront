'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { ErrorSurface } from '@/components/templates/ErrorSurface';
import { buildTechnicalDetails, type RuntimeErrorVariant } from '@/lib/wave5/error-surface';

const VARIANTS: RuntimeErrorVariant[] = ['server-error', 'service-unavailable', 'offline'];

export default function ErrorPreviewPage() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('wave5_errors');
  const requestedVariant = searchParams.get('variant');
  const variant = VARIANTS.includes(requestedVariant as RuntimeErrorVariant)
    ? (requestedVariant as RuntimeErrorVariant)
    : 'server-error';

  const details = buildTechnicalDetails(null, t(`runtime.${variant}.suggested_action`), new Date('2026-05-18T12:00:00.000Z'));

  return (
    <ErrorSurface
      data-testid="runtime-error-preview"
      eyebrow={t(`runtime.${variant}.eyebrow`)}
      title={t(`runtime.${variant}.title`)}
      description={t(`runtime.${variant}.body`)}
      tone={variant === 'offline' ? 'warning' : 'error'}
      role={variant === 'offline' ? 'status' : 'alert'}
      primaryAction={
        <Link
          href={`/${locale}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-3 text-sm font-medium text-action-on-primary no-underline"
        >
          {t(`runtime.${variant}.primary_cta`)}
        </Link>
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
    />
  );
}
