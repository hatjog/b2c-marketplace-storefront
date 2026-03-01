'use client';

import { useState } from 'react';

import { Button } from '@/components/atoms';

import { Modal } from '../Modal/Modal';
import { ReportListingForm } from '../ReportListingForm/ReportListingForm';

export const ProductReportButton = () => {
  const [openModal, setOpenModal] = useState(false);
  return (
    <>
      <Button
        className="label-md uppercase"
        variant="tonal"
        onClick={() => setOpenModal(true)}
      >
        Report listing
      </Button>
      {openModal && (
        <Modal
          heading="Report listing"
          onClose={() => setOpenModal(false)}
        >
          <ReportListingForm onClose={() => setOpenModal(false)} />
        </Modal>
      )}
    </>
  );
};
