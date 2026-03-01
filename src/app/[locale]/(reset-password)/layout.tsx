import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header>
        <div className="relative w-full px-4 py-2 lg:px-8">
          <div className="flex w-full items-center justify-center pl-4 lg:pl-0">
            <LocalizedClientLink
              href="/"
              className="text-2xl font-bold"
            >
              <Image
                src="/Logo.svg"
                width={126}
                height={40}
                alt="Logo"
                priority
              />
            </LocalizedClientLink>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
