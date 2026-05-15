// W1-01 Home v3 — Editorial Dark Band "Cichy luksus" + Editorial Grid 5-vibe mood.
// BonBeauty DS v2.1.0: bb-dark-gradient, bb-surface, cta, text-primary, text-on-action tokens.
// Story 3.0 Sprint 1 thin slice gate.

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

const DEFAULT_VIBES: VibeCard[] = [
  { id: 'relax', title: 'Relaks', subtitle: 'Chwila dla siebie', href: '/categories/relaks', imageUrl: undefined },
  { id: 'beauty', title: 'Piękno', subtitle: 'Pielęgnacja skóry', href: '/categories/beauty', imageUrl: undefined },
  { id: 'gift', title: 'Prezent', subtitle: 'Wyjątkowy moment', href: '/categories/prezenty', imageUrl: undefined },
  { id: 'wellness', title: 'Wellness', subtitle: 'Zdrowy styl życia', href: '/categories/wellness', imageUrl: undefined },
  { id: 'luxury', title: 'Luksus', subtitle: 'Premium doświadczenie', href: '/categories/premium', imageUrl: undefined },
];

export function EditorialDarkBandBlock({
  heading = 'Cichy luksus',
  subheading = 'Odkryj wyjątkowe zabiegi w najlepszych salonach',
  vibes = DEFAULT_VIBES,
}: EditorialDarkBandBlockProps) {
  return (
    <section
      className="relative overflow-hidden"
      data-testid="editorial-dark-band"
      aria-label="Editorial — Cichy luksus"
      style={{
        background:
          'var(--bb-dark-gradient, linear-gradient(145deg,#1a1a1a 0%,#382a10 100%))',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8 lg:py-24">
        {/* Band heading */}
        <div className="mb-10 text-center md:mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-5xl">
            {heading}
          </h2>
          <p className="mt-3 text-base text-[color:rgba(250,248,245,0.7)] md:text-lg">
            {subheading}
          </p>
        </div>

        {/* Editorial Grid — 5-vibe mood */}
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5"
          data-testid="editorial-grid-5-vibe"
        >
          {vibes.map((vibe) => (
            <LocalizedClientLink
              key={vibe.id}
              href={vibe.href}
              className="group relative flex flex-col items-center justify-end overflow-hidden rounded-[var(--bb-radius-card)] border border-[color:rgba(250,248,245,0.12)] bg-[color:rgba(255,255,255,0.06)] p-4 transition-all duration-200 hover:bg-[color:rgba(255,255,255,0.10)] hover:border-[color:rgba(197,160,89,0.4)]"
              data-testid={`vibe-card-${vibe.id}`}
              style={{ minHeight: '160px' }}
            >
              <span className="absolute inset-0 rounded-[var(--bb-radius-card)] bg-gradient-to-t from-black/60 to-transparent" aria-hidden="true" />
              <div className="relative z-10 text-center">
                <p className="text-base font-semibold text-white">{vibe.title}</p>
                <p className="mt-0.5 text-xs text-[color:rgba(250,248,245,0.65)]">{vibe.subtitle}</p>
              </div>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
