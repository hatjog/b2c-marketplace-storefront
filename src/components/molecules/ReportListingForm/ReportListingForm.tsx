'use client';

import { ReportForm } from '../ReportForm/ReportForm';

/** Thin wrapper over the shared {@link ReportForm}; differs only by submit label. */
export const ReportListingForm = ({ onClose }: { onClose: () => void }) => (
  <ReportForm
    onClose={onClose}
    submitLabelKey="report.submit_listing"
  />
);
