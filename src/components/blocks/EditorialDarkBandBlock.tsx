// W1-01 Home v3 — Editorial Dark Band "Cichy luksus" + Editorial Grid 5-vibe mood.
// BonBeauty DS v2.1.0: bb-dark-gradient, bb-surface, cta, text-primary, text-on-action tokens.
// Story 3.0 Sprint 1 thin slice gate.
import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { FEATURED_CATEGORY_HANDLES } from '@/data/categories-featured';
import { listCategories } from '@/lib/data/categories';

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

type VibeCurationPreset = {
  id: string;
  translationKey: 'calm' | 'energy' | 'clarity' | 'warmth' | 'seasonal';
  preferredHandles: readonly string[];
  fallbackFilter: 'premium' | 'popular' | 'new' | 'offers';
  mode?: 'gift';
};

const VIBE_CURATION_PRESETS: readonly VibeCurationPreset[] = [
  {
    id: 'calm',
    translationKey: 'calm',
    preferredHandles: ['pielegnacja-twarzy', 'facial-care'],
    fallbackFilter: 'premium',
  },
  {
    id: 'energy',
    translationKey: 'energy',
    preferredHandles: ['masaz', 'massage'],
    fallbackFilter: 'popular',
  },
  {
    id: 'clarity',
    translationKey: 'clarity',
    preferredHandles: ['facial-care', 'pielegnacja-twarzy'],
    fallbackFilter: 'new',
  },
  {
    id: 'warmth',
    translationKey: 'warmth',
    preferredHandles: ['rytualy-spa', 'spa-rituals'],
    fallbackFilter: 'offers',
  },
  {
    id: 'seasonal',
    translationKey: 'seasonal',
    preferredHandles: ['rytualy-spa', 'spa-rituals'],
    fallbackFilter: 'popular',
    mode: 'gift',
  },
];

function resolveCuratedHref(
  preset: VibeCurationPreset,
  availableHandles: Set<string>,
): string {
  const matchedHandle = [...preset.preferredHandles, ...FEATURED_CATEGORY_HANDLES].find((handle) =>
    availableHandles.has(handle),
  );

  if (matchedHandle) {
    const params = new URLSearchParams();
    if (preset.mode) {
      params.set('mode', preset.mode);
    }
    const query = params.toString();
    return query
      ? `/categories/${matchedHandle}?${query}`
      : `/categories/${matchedHandle}`;
  }

  const fallbackParams = new URLSearchParams();
  fallbackParams.set('filter', preset.fallbackFilter);
  if (preset.mode) {
    fallbackParams.set('mode', preset.mode);
  }
  return `/categories?${fallbackParams.toString()}`;
}

async function buildDefaultVibes(t: Awaited<ReturnType<typeof getTranslations>>): Promise<VibeCard[]> {
  const { categories } = await listCategories({
    query: {
      include_ancestors_tree: true,
      include_descendants_tree: true,
      limit: 120,
    },
  });
  const availableHandles = new Set(
    categories
      .map((category) => String(category?.handle ?? '').trim())
      .filter((handle) => handle.length > 0),
  );

  return VIBE_CURATION_PRESETS.map((preset) => ({
    id: preset.id,
    title: t(`editorial.vibes.${preset.translationKey}.title`),
    subtitle: t(`editorial.vibes.${preset.translationKey}.subtitle`),
    href: resolveCuratedHref(preset, availableHandles),
  }));
}

function buildFallbackVibes(t: Awaited<ReturnType<typeof getTranslations>>): VibeCard[] {
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
      href: '/categories?filter=popular&mode=gift',
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
  const resolvedVibes = vibes ?? (await buildDefaultVibes(t).catch(() => buildFallbackVibes(t)));

  return (
    <section
      id="editorial-selection"
      className="bb-section-shell bb-section-shell-soft overflow-hidden bg-[var(--bb-dark-gradient)]"
      data-testid="editorial-dark-band"
      aria-label={t('editorial.aria_label')}
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-2 py-6 md:px-3 md:py-8 lg:grid-cols-[0.9fr_1.4fr] lg:px-4 lg:py-10">
        <div className="flex flex-col justify-center">
          <p className="bb-eyebrow text-[var(--gold)]">{t('editorial.eyebrow')}</p>
          <h2 className="heading-xl mt-3 max-w-[11ch] text-white">
            {resolvedHeading}
          </h2>
          <p className="mt-3 max-w-[52ch] text-base text-white/78 md:text-lg">
            {resolvedSubheading}
          </p>
        </div>

        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-5"
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
