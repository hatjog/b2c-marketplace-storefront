// W1-01 Home v3 — Editorial Dark Band "Cichy luksus" + Editorial Grid 5-vibe mood.
// BonBeauty DS v2.1.0: bb-dark-gradient, bb-surface, cta, text-primary, text-on-action tokens.
// Story 3.0 Sprint 1 thin slice gate.
import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

interface VibeCard {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  href: string;
}

interface EditorialDarkBandBlockProps {
  heading?: string;
  subheading?: string;
  vibes?: VibeCard[];
  locale: string;
}

function buildDefaultVibes(t: Awaited<ReturnType<typeof getTranslations>>): VibeCard[] {
  return [
    {
      id: 'calm',
      title: t('editorial.vibes.calm.title'),
      subtitle: t('editorial.vibes.calm.subtitle'),
      href: '/categories?filter=premium',
    },
    {
      id: 'energy',
      title: t('editorial.vibes.energy.title'),
      subtitle: t('editorial.vibes.energy.subtitle'),
      href: '/categories?filter=popular',
    },
    {
      id: 'clarity',
      title: t('editorial.vibes.clarity.title'),
      subtitle: t('editorial.vibes.clarity.subtitle'),
      href: '/categories?filter=new',
    },
    {
      id: 'warmth',
      title: t('editorial.vibes.warmth.title'),
      subtitle: t('editorial.vibes.warmth.subtitle'),
      href: '/categories?filter=offers',
    },
    {
      id: 'seasonal',
      title: t('editorial.vibes.seasonal.title'),
      subtitle: t('editorial.vibes.seasonal.subtitle'),
      href: '/categories?mode=gift',
    },
  ];
}

export async function EditorialDarkBandBlock({
  heading,
  subheading,
  vibes,
  locale,
}: EditorialDarkBandBlockProps) {
  const t = await getTranslations({ locale, namespace: 'home_v3' });
  const resolvedHeading = heading ?? t('editorial.heading');
  const resolvedSubheading = subheading ?? t('editorial.body');
  const resolvedVibes = vibes ?? buildDefaultVibes(t);

  return (
    <section
      id="editorial-selection"
      className="bb-section-shell overflow-hidden bg-[var(--bb-dark-gradient)]"
      data-testid="editorial-dark-band"
      aria-label={t('editorial.aria_label')}
    >
      <div className="mx-auto max-w-7xl px-2 py-6 md:px-3 md:py-8 lg:px-4 lg:py-10">
        {/* Band heading */}
        <div className="mb-10 text-center md:mb-12">
          <p className="bb-eyebrow text-[var(--gold)]">{t('editorial.eyebrow')}</p>
          <h2 className="heading-xl mt-3 text-white">
            {resolvedHeading}
          </h2>
          <p className="mt-3 text-base text-white/78 md:text-lg">
            {resolvedSubheading}
          </p>
        </div>

        {/* Editorial Grid — 5-vibe mood */}
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-5"
          data-testid="editorial-grid-5-vibe"
        >
          {resolvedVibes.map((vibe) => (
            <LocalizedClientLink
              key={vibe.id}
              href={vibe.href}
              className="group relative flex flex-col items-center justify-end overflow-hidden rounded-[var(--bb-radius-card)] border border-white/15 bg-white/5 p-4 transition-all duration-200 hover:border-[var(--gold)] hover:bg-white/10"
              data-testid={`vibe-card-${vibe.id}`}
              style={{ minHeight: '172px' }}
            >
              <span
                className="absolute inset-0 rounded-[var(--bb-radius-card)] bg-gradient-to-t from-black/60 to-transparent"
                aria-hidden="true"
              />
              <div className="relative z-10 text-center">
                <p className="text-base font-semibold text-white">{vibe.title}</p>
                <p className="mt-0.5 text-xs text-white/70">{vibe.subtitle}</p>
              </div>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
