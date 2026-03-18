'use client';

import { useState } from 'react';

import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

import { Button, Divider } from '@/components/atoms';
import { Modal, ReportSellerForm } from '@/components/molecules';
import type { SellerProps } from '@/types/seller';

export const SellerFooter = ({ seller }: { seller: SellerProps }) => {
  const t = useTranslations('products');
  const [openModal, setOpenModal] = useState(false);
  return (
    <div className="flex flex-col items-center justify-between p-5 lg:flex-row">
      <div className="label-sm lg:label-md mb-4 flex w-full items-center justify-between gap-2 text-secondary lg:mb-0 lg:w-auto lg:justify-start lg:gap-4">
        {/* {seller.verified && (
          <div className="flex items-center gap-2">
            <DoneIcon size={20} />
            Verified seller
          </div>
        )} */}
        <Divider square />
        <p>{t('seller_joined', { date: format(seller.created_at, 'yyyy-MM-dd') })}</p>
        {/* <Divider square /> */}
        {/* <p>sold {seller.sold}</p> */}
      </div>
      <Button
        variant="text"
        size="large"
        className="uppercase"
        onClick={() => setOpenModal(true)}
      >
        {t('report_seller')}
      </Button>
      {openModal && (
        <Modal
          heading="Report seller"
          onClose={() => setOpenModal(false)}
        >
          <ReportSellerForm onClose={() => setOpenModal(false)} />
        </Modal>
      )}
    </div>
  );
};
