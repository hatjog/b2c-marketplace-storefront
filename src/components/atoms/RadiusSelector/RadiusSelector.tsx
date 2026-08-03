'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, type ChangeEvent } from 'react';

import {
  clampRadius,
  DEFAULT_RADIUS,
  RADIUS_OPTIONS,
  type RadiusOption,
} from './clampRadius';

/**
 * Story v160-4-3 — radius selector for "Blisko mnie" filter.
 *
 * Conditional render: parent only mounts this when `?nearMe=1`. Component
 * defensively reads `searchParams.nearMe` and returns `null` if missing.
 *
 * URL contract: changing the select pushes `?radius=N` and preserves all
 * other params (q, city, sort, view, lat, lng, nearMe). Out-of-range
 * values clamp to the nearest valid option (5/10/25/50).
 *
 * Helper constants/functions live in `./clampRadius.ts` (not here) so the
 * server-rendered `page.tsx` and `seller.ts` can import them without
 * tripping Next.js' "called a client export from the server" guard.
 */

export interface RadiusSelectorProps {
  /** Optional override of the default selected radius. */
  defaultRadiusKm?: RadiusOption;
}

export function RadiusSelector({
  defaultRadiusKm = DEFAULT_RADIUS,
}: RadiusSelectorProps) {
  const t = useTranslations('seller.list');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActive = searchParams.get('nearMe') === '1';

  const rawRadius = searchParams.get('radius');
  const parsedRadius =
    rawRadius != null ? Number.parseInt(rawRadius, 10) : defaultRadiusKm;
  const currentRadius = clampRadius(parsedRadius);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const next = clampRadius(Number.parseInt(event.target.value, 10));
      const params = new URLSearchParams(searchParams.toString());
      params.set('radius', String(next));
      // Reset offset when filter scope changes.
      params.delete('offset');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  if (!isActive) return null;

  return (
    <div className="md:w-40">
      <label
        htmlFor="sellers-radius-selector"
        className="label-md mb-1 block text-sm font-medium"
      >
        {t('near_me_radius_label')}
      </label>
      <select
        id="sellers-radius-selector"
        value={currentRadius}
        onChange={handleChange}
        className="w-full rounded-sm border bg-component-secondary px-4 py-3 focus:border-primary focus:outline-none focus:ring-0"
        data-testid="sellers-radius-selector"
      >
        {RADIUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(`radius_${option}km` as `radius_5km` | `radius_10km` | `radius_25km` | `radius_50km`)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default RadiusSelector;
