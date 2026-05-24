'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export function CartEmpty() {
  const t = useTranslations('cart');

  return (
    <section
      className="col-span-12 flex justify-center py-10"
      role="region"
      aria-labelledby="cart-empty-heading"
      data-testid="cart-empty"
    >
      <div className="flex w-full max-w-[480px] flex-col items-center rounded-[28px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-82)] px-8 py-10 text-center shadow-[0_16px_40px_rgba(90,67,28,0.08)]">
        <span
          aria-hidden="true"
          className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full border border-[var(--bb-tint-gold-22)] bg-[var(--bb-cream-90)] text-primary"
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 12H36L33 33H11L8 12Z"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path
              d="M16 12C16 8.68629 18.6863 6 22 6C25.3137 6 28 8.68629 28 12"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M14 30L30 16"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle
              cx="14"
              cy="30"
              r="2"
              fill="currentColor"
            />
          </svg>
        </span>
        <h3
          id="cart-empty-heading"
          className="heading-lg text-primary"
        >
          {t('empty_es3_heading')}
        </h3>
        <p className="mt-3 text-lg text-secondary">
          {t('empty_es3_body')}
        </p>
        <LocalizedClientLink
          href="/#editorial-selection"
          className="mt-7 w-full"
        >
          <Button className="flex w-full items-center justify-center py-3">{t('empty_es3_cta')}</Button>
        </LocalizedClientLink>
      </div>
    </section>
  );
}
