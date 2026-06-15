'use client';

import { useTranslations } from 'next-intl';

import styles from './SellerMap.module.css';
import type { SellerMapMode } from './modes';

interface SellerMapSkeletonProps {
  mode: SellerMapMode;
}

export function SellerMapSkeleton({ mode }: SellerMapSkeletonProps) {
  const t = useTranslations('seller.map');

  return (
    <div
      role="status"
      aria-label={t('skeleton_aria_label')}
      className={`${styles.shell} ${styles[`mode-${mode}`]} ${styles.skeleton}`}
      data-testid="seller-map-skeleton"
    >
      <span>{t('loading')}</span>
    </div>
  );
}
