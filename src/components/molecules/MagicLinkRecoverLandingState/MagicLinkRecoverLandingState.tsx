/**
 * MagicLinkRecoverLandingState — W3-06 click-to-continue + neutral error
 * landing state (Story 5.3).
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review CRITICAL P0):
 *   - `mode="continue"` renders the explicit-gesture click-to-continue
 *     form that submits the token via Server Action.
 *   - `mode="neutral"` renders the anti-enumeration single-state error
 *     copy — caller cannot distinguish expired / consumed / revoked.
 *
 * Server component — token is read from page params, passed in a hidden
 * input, and NEVER rendered into visible DOM nor logged.
 */

import { getTranslations } from 'next-intl/server';

import { verifyMagicLinkRecoverForm } from '@/actions/recover-magic-link';

type Mode = 'continue' | 'neutral';

interface Props {
  locale: string;
  token?: string;
  mode: Mode;
}

export async function MagicLinkRecoverLandingState({ locale, token, mode }: Props) {
  const t = await getTranslations({ locale, namespace: 'auth.magic_link_recover' });

  if (mode === 'continue' && token) {
    return (
      <div
        className="flex w-full flex-col items-center gap-6 text-center"
        data-testid="magic-link-recover-continue"
      >
        <h2 className="heading-sm text-[var(--text-primary)]">{t('landing.continue_title')}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{t('landing.continue_body')}</p>
        <form
          action={verifyMagicLinkRecoverForm}
          method="POST"
          className="flex w-full max-w-sm flex-col gap-3"
          data-testid="magic-link-recover-continue-form"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="min-h-12 rounded-full bg-[var(--bg-action)] px-6 py-3 font-medium text-[var(--text-on-action)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2"
            data-testid="magic-link-recover-continue-cta"
          >
            {t('landing.continue_cta')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex w-full flex-col items-center gap-4 text-center"
      data-testid="magic-link-recover-neutral"
    >
      <h2 className="heading-sm text-[var(--text-primary)]">{t('landing.neutral_title')}</h2>
      <p className="text-sm text-[var(--text-secondary)]">{t('landing.neutral_body')}</p>
      <a
        href={`/${locale}/user/recover`}
        className="text-sm font-medium text-[var(--text-primary)] underline underline-offset-4"
        data-testid="magic-link-recover-request-new"
      >
        {t('landing.request_new_link')}
      </a>
    </div>
  );
}
