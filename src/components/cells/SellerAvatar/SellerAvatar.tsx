import Image from 'next/image';

export const SellerAvatar = ({
  photo = '',
  size = 32,
  alt = ''
}: {
  photo?: string;
  size?: number;
  alt?: string;
}) => {
  return photo ? (
    <Image
      src={decodeURIComponent(photo)}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0"
      style={{ maxWidth: size, maxHeight: size }}
    />
  ) : (
    <Image
      src="/images/placeholder.svg"
      alt={alt}
      className="h-8 w-8 shrink-0 opacity-30"
      width={32}
      height={32}
      style={{ maxWidth: 32, maxHeight: 32 }}
    />
  );
};
