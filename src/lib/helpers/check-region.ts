import { isSupportedLocale } from '@/i18n/routing';

/**
 * Validate that the given locale is a supported language code (pl, en).
 * Replaces the previous country-code validation against Medusa regions.
 * URL segment now represents language (ADR-046), not country.
 */
export const checkRegion = (_locale: string): Promise<boolean> => {
  return Promise.resolve(isSupportedLocale(_locale));
};
