import Image from 'next/image';
import Link from 'next/link';

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

const HASH_COLORS = [
  'bg-amber-100',
  'bg-rose-100',
  'bg-violet-100',
  'bg-emerald-100',
  'bg-sky-100'
] as const;

export function hashColor(handle: string): string {
  const sum = handle.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return HASH_COLORS[sum % HASH_COLORS.length];
}

function pluralizeProducts(count: number): string {
  if (count === 1) return '1 produkt';
  const lastTwo = count % 100;
  if (lastTwo >= 12 && lastTwo <= 14) return `${count} produktów`;
  const lastDigit = count % 10;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} produkty`;
  return `${count} produktów`;
}

export interface SellerCardProps {
  name: string;
  handle: string;
  photo_url?: string | null;
  city?: string | null;
  product_count: number;
}

export function SellerCard({ name, handle, photo_url, city, product_count }: SellerCardProps) {
  return (
    <Link
      href={`/sellers/${handle}`}
      className="group block rounded-xl overflow-hidden border border-gray-100 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      aria-label={name}
      data-testid="seller-card"
    >
      {photo_url ? (
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={photo_url}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div
          className="aspect-[16/9] flex items-center justify-center"
          style={{
            background: 'linear-gradient(to bottom right, var(--gold-light, #fef3c7), rgb(var(--brand-50, 238 238 238)))'
          }}
        >
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-gray-700 ${hashColor(handle)}`}
          >
            {getInitials(name)}
          </span>
        </div>
      )}

      <div className="p-4">
        <p className="font-semibold text-gray-900 truncate">{name}</p>
        {city && (
          <p className="mt-0.5 text-sm text-gray-500 truncate">{city}</p>
        )}
        <p className="mt-1 text-sm text-gray-400">{pluralizeProducts(product_count)}</p>
      </div>
    </Link>
  );
}
