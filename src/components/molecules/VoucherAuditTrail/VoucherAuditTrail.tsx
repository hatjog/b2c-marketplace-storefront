import { getTranslations } from 'next-intl/server';

import type { VoucherAuditEvent } from '@/types/voucher';

/**
 * Story v160-6-3: VoucherAuditTrail molecule — recipient-visible 4-5 event
 * timeline (created → sent → opened → claimed [+ withdrawn]) rendered as a
 * native HTML `<details>` collapsible (Path A — zero JS, accessibility built-
 * in). Consumed by Story 6.1 claim page in the post-claim state.
 *
 * Privacy invariant (AR45):
 *   - Each event is rendered with ONLY event_type + occurred_at copy. The
 *     `metadata` field is intentionally typed `Record<string, never>` and is
 *     never read in this component, so no buyer-side fields can reach the DOM.
 *   - Privacy notice footer reinforces the boundary in plain language.
 *
 * Gold-dot visual marker: each event row carries a `data-event="<type>"`
 * attribute matching the gold-dot hooks placed in Story 6.1 — visual coherence
 * between the partial post-claim view (single dot) and the full collapsible
 * timeline (this molecule).
 */

export interface VoucherAuditTrailProps {
  events: VoucherAuditEvent[];
  locale: string;
  className?: string;
}

const EVENT_KEY_BY_TYPE = {
  created: 'event_created',
  sent: 'event_sent',
  opened: 'event_opened',
  claimed: 'event_claimed',
  withdrawn: 'event_withdrawn'
} as const;

function formatTimestamp(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(locale === 'en' ? 'en-US' : 'pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

export async function VoucherAuditTrail({
  events,
  locale,
  className
}: VoucherAuditTrailProps) {
  const t = await getTranslations({
    locale,
    namespace: 'voucher.audit_trail'
  });

  // Defensive ordering — caller is expected to provide ASC-sorted events but
  // we re-sort to enforce contract at render time.
  const ordered = [...events].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at)
  );

  return (
    <details
      data-testid="voucher-audit-trail"
      className={['bb-section-shell rounded-sm border border-tertiary p-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      <summary className="cursor-pointer list-none">
        <h3 className="heading-sm">{t('title')}</h3>
        <span className="label-md text-secondary">
          {t('toggle_show')}
        </span>
      </summary>

      {ordered.length === 0 ? (
        <p
          data-testid="voucher-audit-trail-empty"
          className="mt-4 text-secondary"
        >
          {t('empty_state')}
        </p>
      ) : (
        <ol
          data-testid="voucher-audit-trail-list"
          className="mt-4 flex flex-col gap-3"
        >
          {ordered.map((event) => {
            const key = EVENT_KEY_BY_TYPE[event.event_type];
            if (!key) return null;
            return (
              <li
                key={event.id}
                data-testid={`voucher-audit-event-${event.event_type}`}
                className="flex items-start gap-3"
              >
                <span
                  className="gold-dot mt-1 inline-block h-2 w-2 rounded-full bg-primary"
                  data-event={event.event_type}
                  aria-hidden="true"
                />
                <div className="flex flex-col">
                  <span className="text-primary">{t(key)}</span>
                  <time
                    dateTime={event.occurred_at}
                    className="label-sm text-secondary"
                  >
                    {formatTimestamp(event.occurred_at, locale)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 label-sm text-secondary">{t('privacy_notice')}</p>
    </details>
  );
}
