import Link from 'next/link';

import { Button } from '@/components/atoms';
import { ArrowRightIcon } from '@/icons';

export const SellNowButton = () => {
  return (
    <Link href={process.env.NEXT_PUBLIC_VENDOR_URL || 'https://vendor.mercurjs.com'}>
      <Button className="group flex items-center gap-1 pl-12 !font-bold uppercase">
        Sell now
        <ArrowRightIcon
          color="white"
          className="h-5 w-5 opacity-0 transition-all duration-300 group-hover:opacity-100"
        />
      </Button>
    </Link>
  );
};
