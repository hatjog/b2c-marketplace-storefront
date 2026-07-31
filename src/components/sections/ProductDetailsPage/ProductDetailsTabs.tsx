'use client';

import { useRef, useState, type KeyboardEvent } from 'react';

import { useTranslations } from 'next-intl';
import Image from 'next/image';

import { SanitizedHTML } from '@/components/molecules/SanitizedHTML/SanitizedHTML';
import { VoucherRulesCard } from '@/components/molecules/VoucherRulesCard/VoucherRulesCard';
import type { PdpVoucherRules } from '@/lib/helpers/pdp';
import type { SellerGalleryItem, SellerOpeningHours } from '@/types/seller';

type Review = {
  id?: string;
  rating?: number | null;
  customer_note?: string | null;
  username?: string | null;
  locale?: string | null;
  provenance?: string | null;
  provenance_tag?: string | null;
  metadata?: {
    gp?: {
      locale?: string | null;
      provenance?: string | null;
      provenance_tag?: string | null;
    } | null;
    locale?: string | null;
    provenance?: string | null;
    provenance_tag?: string | null;
  } | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
};

export type ProductDetailsTabsSeller = {
  name?: string | null;
  description?: string | null;
  address?: string | null;
  openingHours?: SellerOpeningHours | null;
  gallery?: SellerGalleryItem[] | null;
  rating?: number | null;
  ratingCount?: number | null;
  reviews?: Review[];
};

type TabId = 'description' | 'voucher' | 'salon' | 'reviews' | 'faq';

interface ProductDetailsTabsProps {
  description: string | null;
  voucherRules: PdpVoucherRules;
  seller: ProductDetailsTabsSeller | null;
  reviews?: Review[];
  reviewsRating?: number | null;
  reviewsRatingCount?: number | null;
}

const TAB_IDS: TabId[] = ['description', 'voucher', 'salon', 'reviews', 'faq'];

export function ProductDetailsTabs({
  description,
  voucherRules,
  seller,
  reviews = [],
  reviewsRating = null,
  reviewsRatingCount = null
}: ProductDetailsTabsProps) {
  const t = useTranslations('pdp.tabs');
  const [activeTab, setActiveTab] = useState<TabId>('description');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTab(index: number) {
    setFocusedIndex(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab((index + 1) % TAB_IDS.length);
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab((index - 1 + TAB_IDS.length) % TAB_IDS.length);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusTab(TAB_IDS.length - 1);
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveTab(TAB_IDS[index]);
    }
  }

  return (
    <section
      className="mt-12"
      data-testid="pdp-tabs"
    >
      <div
        role="tablist"
        aria-label={t('aria_label')}
        className="sticky top-[var(--site-header-height,72px)] z-20 flex gap-4 overflow-x-auto border-b border-[var(--bb-border-soft)] bg-[var(--bb-page-bg)] backdrop-blur"
        data-testid="pdp-tabs-sticky"
      >
        {TAB_IDS.map((tabId, index) => {
          const selected = activeTab === tabId;

          return (
            <button
              key={tabId}
              ref={node => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`pdp-tab-${tabId}`}
              aria-selected={selected}
              aria-controls={`pdp-panel-${tabId}`}
              tabIndex={focusedIndex === index ? 0 : -1}
              onClick={() => {
                setActiveTab(tabId);
                setFocusedIndex(index);
              }}
              onKeyDown={event => handleKeyDown(event, index)}
              className={`min-h-[48px] shrink-0 border-b-2 px-1 text-sm font-medium tracking-normal ${
                selected
                  ? 'border-[var(--gold)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)]'
              }`}
            >
              {t(`${tabId}.label`)}
            </button>
          );
        })}
      </div>

      <div className="py-8">
        <div
          role="tabpanel"
          id="pdp-panel-description"
          aria-labelledby="pdp-tab-description"
          tabIndex={0}
          hidden={activeTab !== 'description'}
        >
          <DescriptionPanel
            description={description}
            fallback={t('description.fallback')}
          />
        </div>
        <div
          role="tabpanel"
          id="pdp-panel-voucher"
          aria-labelledby="pdp-tab-voucher"
          tabIndex={0}
          hidden={activeTab !== 'voucher'}
        >
          <VoucherPanel rules={voucherRules} />
        </div>
        <div
          role="tabpanel"
          id="pdp-panel-salon"
          aria-labelledby="pdp-tab-salon"
          tabIndex={0}
          hidden={activeTab !== 'salon'}
        >
          <SellerPanel seller={seller} />
        </div>
        <div
          role="tabpanel"
          id="pdp-panel-reviews"
          aria-labelledby="pdp-tab-reviews"
          tabIndex={0}
          hidden={activeTab !== 'reviews'}
        >
          <ReviewsPanel
            reviews={reviews}
            rating={reviewsRating}
            ratingCount={reviewsRatingCount}
          />
        </div>
        <div
          role="tabpanel"
          id="pdp-panel-faq"
          aria-labelledby="pdp-tab-faq"
          tabIndex={0}
          hidden={activeTab !== 'faq'}
        >
          <FaqPanel />
        </div>
      </div>
    </section>
  );
}

function DescriptionPanel({
  description,
  fallback
}: {
  description: string | null;
  fallback: string;
}) {
  return (
    <div className="max-w-3xl space-y-4 text-[var(--text-primary)]">
      {description ? (
        <SanitizedHTML
          html={description}
          className="product-details"
          // Partner descriptions author sections as <h4>; promote one level so they
          // sit under the surrounding <h2> without a skipped heading level (axe heading-order).
          headingShift={-1}
        />
      ) : (
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{fallback}</p>
      )}
    </div>
  );
}

function VoucherPanel({ rules }: { rules: PdpVoucherRules }) {
  return (
    <div className="max-w-3xl">
      <VoucherRulesCard
        validityMonths={rules.validityMonths}
        usageConditions={rules.usageConditions}
        refundPolicy={rules.refundPolicy}
        cancellationPolicy={rules.cancellationPolicy}
        extensionPolicy={rules.extensionPolicy}
        noShowPolicy={rules.noShowPolicy}
        defaultOpen
        data-testid="pdp-voucher-rules-card-detailed"
      />
    </div>
  );
}

function SellerPanel({ seller }: { seller: ProductDetailsTabsSeller | null }) {
  const t = useTranslations('pdp.tabs.salon');
  const gallery = seller?.gallery?.filter(item => item?.url).slice(0, 3) ?? [];
  const openingHours = seller?.openingHours
    ? Object.entries(seller.openingHours).filter(
        (entry): entry is [string, { open: string; close: string }] => Boolean(entry[1])
      )
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
      <div className="space-y-4">
        <h2 className="text-2xl font-medium text-[var(--text-primary)]">
          {seller?.name ?? t('fallback_name')}
        </h2>
        {seller?.description ? (
          <SanitizedHTML
            html={seller.description}
            className="product-details"
          />
        ) : (
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            {t('fallback_description')}
          </p>
        )}
        {gallery.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {gallery.map((item, index) => (
              <div
                key={`${item.url}-${index}`}
                className="relative aspect-[4/3] overflow-hidden rounded-[var(--bb-radius-card)] bg-[var(--bb-surface-muted)]"
              >
                <Image
                  src={item.url}
                  alt={item.alt ?? t('gallery_alt', { name: seller?.name ?? t('fallback_name') })}
                  fill
                  sizes="(min-width: 1024px) 24vw, 100vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <aside className="space-y-4 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-5">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{t('address')}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            {seller?.address ?? t('address_fallback')}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{t('hours')}</h3>
          {openingHours.length > 0 ? (
            <dl className="mt-2 space-y-2 text-sm text-[var(--text-secondary)]">
              {openingHours.map(([day, hours]) => (
                <div
                  key={day}
                  className="flex justify-between gap-4"
                >
                  <dt>{day}</dt>
                  <dd>
                    {hours.open} - {hours.close}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {t('hours_fallback')}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function pickReviewMeta(review: Review) {
  return {
    locale: review.locale ?? review.metadata?.gp?.locale ?? review.metadata?.locale ?? null,
    provenance:
      review.provenance ??
      review.provenance_tag ??
      review.metadata?.gp?.provenance ??
      review.metadata?.gp?.provenance_tag ??
      review.metadata?.provenance ??
      review.metadata?.provenance_tag ??
      null
  };
}

function ReviewsPanel({
  reviews,
  rating,
  ratingCount
}: {
  reviews: Review[];
  rating: number | null;
  ratingCount: number | null;
}) {
  const t = useTranslations('pdp.tabs.reviews');
  const visibleReviews = reviews.slice(0, 3);

  if (!visibleReviews.length) {
    return (
      <div className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-5 text-sm text-[var(--text-secondary)]">
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-secondary)]">
        {rating != null && ratingCount != null
          ? t('summary', { rating: rating.toFixed(1), count: ratingCount })
          : t('summary_no_rating')}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {visibleReviews.map((review, index) => {
          const customerName = [review.customer?.first_name, review.customer?.last_name]
            .filter(Boolean)
            .join(' ');
          const author = review.username || customerName || t('anonymous');
          const meta = pickReviewMeta(review);

          return (
            <article
              key={review.id ?? index}
              className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4"
            >
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {review.rating != null
                  ? t('rating', { rating: review.rating.toFixed(1) })
                  : t('no_rating')}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {review.customer_note || t('review_fallback')}
              </p>
              <p className="mt-3 text-xs text-[var(--text-secondary)]">{author}</p>
              {(meta.locale || meta.provenance) && (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  {[meta.locale, meta.provenance].filter(Boolean).join(' · ')}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function FaqPanel() {
  const t = useTranslations('pdp.tabs.faq');

  return (
    <div className="max-w-3xl space-y-3">
      {(['delivery', 'refund', 'recipient'] as const).map(key => (
        <details
          key={key}
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4"
        >
          <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
            {t(`${key}.question`)}
          </summary>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {t(`${key}.answer`)}
          </p>
        </details>
      ))}
    </div>
  );
}
