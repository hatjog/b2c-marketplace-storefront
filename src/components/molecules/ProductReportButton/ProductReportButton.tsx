'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';

import { Modal } from '../Modal/Modal';
import { ReportListingForm } from '../ReportListingForm/ReportListingForm';

export const ProductReportButton = () => {
  const [openModal, setOpenModal] = useState(false);
  const t = useTranslations('products');

  return (
    <>
      <Button
        className="label-md"
        variant="tonal"
        onClick={() => setOpenModal(true)}
      >
        {t('report_listing')}
      </Button>
      {openModal && (
        <Modal
          heading={t('report_listing')}
          onClose={() => setOpenModal(false)}
        >
          <ReportListingForm onClose={() => setOpenModal(false)} />
        </Modal>
      )}
    </>
  );
};
