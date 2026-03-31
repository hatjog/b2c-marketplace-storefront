const BONBEAUTY_CONTACT_HREF = '/contact';

export interface SellerContactProps {
  phone?: string | null;
  email?: string | null;
}

export function SellerContact({ phone, email }: SellerContactProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
      {phone && (
        <a
          href={`tel:${phone}`}
          className="hover:text-gray-900 transition-colors"
          aria-label={`Zadzwoń: ${phone}`}
        >
          {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="hover:text-gray-900 transition-colors"
          aria-label={`Napisz email: ${email}`}
        >
          {email}
        </a>
      )}
      {!phone && !email && (
        <span>
          Problemy?{' '}
          <a
            href={BONBEAUTY_CONTACT_HREF}
            className="underline hover:no-underline"
          >
            Napisz do BonBeauty
          </a>
        </span>
      )}
    </div>
  );
}
