'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import deMessages from '../../messages/de.json';
import enMessages from '../../messages/en.json';
import plMessages from '../../messages/pl.json';
import uaMessages from '../../messages/ua.json';

import { ErrorSurface } from '@/components/templates/ErrorSurface';
import { buildTechnicalDetails, resolveRuntimeErrorVariant } from '@/lib/wave5/error-surface';

const CATALOGUES = { pl: plMessages, en: enMessages, ua: uaMessages, de: deMessages } as const;

type Locale = keyof typeof CATALOGUES;

function resolveLocaleFromPathname(pathname: string): Locale {
  const segment = pathname.split('/')[1];
  return segment === 'en' || segment === 'ua' || segment === 'de' ? segment : 'pl';
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>('pl');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLocale(resolveLocaleFromPathname(window.location.pathname));
      setOffline(window.navigator.onLine === false);
    }
  }, []);

  const messages = CATALOGUES[locale].wave5_errors;
  const variant = resolveRuntimeErrorVariant(error, { offline });
  const details = buildTechnicalDetails(error, messages.runtime[variant].suggested_action);

  return (
    <html lang={locale}>
      <body style={{ margin: 0 }}>
        <ErrorSurface
          data-testid="global-error"
          eyebrow={messages.runtime[variant].eyebrow}
          title={messages.runtime[variant].title}
          description={messages.runtime[variant].body}
          tone={variant === 'offline' ? 'warning' : 'error'}
          role={variant === 'offline' ? 'status' : 'alert'}
          primaryAction={
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-3 text-sm font-medium text-action-on-primary"
              data-testid="global-error-retry-button"
            >
              {messages.runtime[variant].primary_cta}
            </button>
          }
          utilityLink={
            // v1.9.0 Wave F7 hardening (CC-6 F-CC6-08): only render the
            // status-page link when NEXT_PUBLIC_STATUS_PAGE_URL is set.
            // Story 7.5 explicitly OOS the status.bonbeauty.pl product
            // build; hardcoding the URL was a broken trust signal #1.
            process.env.NEXT_PUBLIC_STATUS_PAGE_URL ? (
              <a
                href={process.env.NEXT_PUBLIC_STATUS_PAGE_URL}
                className="inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-primary underline"
              >
                {messages.runtime.status_link}
              </a>
            ) : undefined
          }
          supportTitle={messages.runtime.support_title}
          supportPaths={[
            {
              id: 'self-service',
              label: messages.runtime.support.self_service.label,
              description: messages.runtime.support.self_service.description,
            },
            {
              id: 'async',
              label: messages.runtime.support.async.label,
              description: messages.runtime.support.async.description,
            },
            {
              id: 'panic',
              label: messages.runtime.support.panic.label,
              description: messages.runtime.support.panic.description,
            },
          ]}
          technicalDetailsLabel={messages.runtime.technical_details}
          technicalDetails={{
            ...details,
            labels: {
              requestId: messages.runtime.technical_details_fields.request_id,
              timestamp: messages.runtime.technical_details_fields.timestamp,
              suggestedAction: messages.runtime.technical_details_fields.suggested_action,
            },
          }}
          secondaryAction={
            variant === 'offline' ? (
              <Link
                href={`/${locale}/pomoc`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-[var(--bb-tint-brown-16)] px-5 py-3 text-sm font-medium text-primary no-underline"
              >
                {messages.runtime.offline.secondary_cta}
              </Link>
            ) : undefined
          }
        />
      </body>
    </html>
  );
}
