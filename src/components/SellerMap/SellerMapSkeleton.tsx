import styles from './SellerMap.module.css';
import type { SellerMapMode } from './modes';

interface SellerMapSkeletonProps {
  mode: SellerMapMode;
}

export function SellerMapSkeleton({ mode }: SellerMapSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Ładowanie mapy salonów"
      className={`${styles.shell} ${styles[`mode-${mode}`]} ${styles.skeleton}`}
      data-testid="seller-map-skeleton"
    >
      <span>Ładowanie mapy...</span>
    </div>
  );
}
