'use client';

import type { ReactNode } from 'react';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { VerifiedMark } from '@/components/atoms/VerifiedMark/VerifiedMark';

export interface SellerHeroProps {
  name: string;
  photo?: string | null;
  tagline?: string;
  verified?: boolean | null;
  verifiedLabel?: string;
  breadcrumbs?: ReactNode;
}

function getMonogram(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

export function SellerHero({
  name,
  photo,
  tagline,
  verified = false,
  verifiedLabel,
  breadcrumbs
}: SellerHeroProps) {
  const t = useTranslations('seller.hero');
  const resolvedTagline = tagline ?? t('tagline');
  const resolvedVerifiedLabel = verifiedLabel ?? t('verified_label');

  return (
    <section
      className="relative overflow-hidden rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-5 py-10 shadow-[var(--bb-shadow-soft)] md:px-8 md:py-12"
      data-testid="seller-hero"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        data-testid="seller-hero-gold-scrim"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(197, 160, 89, 0.24), rgba(249, 244, 236, 0) 58%), linear-gradient(180deg, rgba(239, 229, 210, 0.72), rgba(249, 244, 236, 0.3))'
        }}
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        {breadcrumbs ? (
          <div
            className="mb-6 w-full"
            data-testid="seller-hero-breadcrumbs"
          >
            {breadcrumbs}
          </div>
        ) : null}
        <div className="relative mb-5 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-[var(--gold)] bg-[var(--gold-light)] shadow-[var(--bb-shadow-card)]">
          {photo ? (
            <Image
              src={photo}
              alt={name}
              fill
              sizes="112px"
              className="object-cover"
            />
          ) : (
            <span
              className="font-display text-[34px] font-medium leading-none text-[var(--text-primary)]"
              data-testid="seller-hero-monogram"
            >
              {getMonogram(name)}
            </span>
          )}
        </div>
        {verified ? (
          <VerifiedMark
            label={resolvedVerifiedLabel}
            surface="page"
            data-testid="seller-hero-verified-mark"
            className="mb-4"
          />
        ) : null}
        <p className="mb-3 font-serif text-base italic leading-6 text-[var(--text-secondary)]">
          {resolvedTagline}
        </p>
        <h1
          data-testid="seller-name"
          className="font-display text-[40px] font-medium leading-[46px] text-[var(--text-primary)]"
        >
          {name}
        </h1>
      </div>
    </section>
  );
}
