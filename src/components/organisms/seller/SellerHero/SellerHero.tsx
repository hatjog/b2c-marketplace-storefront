import Image from 'next/image';

export interface SellerHeroProps {
  name: string;
  photo?: string | null;
  badge?: string;
}

export function SellerHero({ name, photo, badge = 'Salon partnerski BonBeauty' }: SellerHeroProps) {
  if (photo) {
    return (
      <div className="relative aspect-[4/3] md:aspect-[16/9] md:max-h-[400px] w-full overflow-hidden rounded-xl" data-testid="seller-hero">
        <Image
          src={photo}
          alt={name}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-4">
          <h1 data-testid="seller-name" className="text-2xl font-bold text-white mb-1 drop-shadow">{name}</h1>
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800">
            {badge}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[4/3] md:aspect-[16/9] md:max-h-[400px] w-full overflow-hidden rounded-xl flex items-end p-4"
      style={{
        background:
          'linear-gradient(to bottom right, var(--gold-light, #fef3c7), var(--brand-50, #f5f5f5))',
      }}
      data-testid="seller-hero"
    >
      <div>
        <h1 data-testid="seller-name" className="text-2xl font-bold text-gray-900 mb-1">{name}</h1>
        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800">
          {badge}
        </span>
      </div>
    </div>
  );
}
