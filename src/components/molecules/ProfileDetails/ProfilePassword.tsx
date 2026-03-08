'use client';

import { useState } from 'react';

// import { ProfilePasswordForm } from "../ProfilePasswordForm/ProfilePasswordForm"
import type { HttpTypes } from '@medusajs/types';
import { Divider, Heading } from '@medusajs/ui';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { Card } from '@/components/atoms/Card/Card';
import { InfoIcon } from '@/icons';
import { sendResetPasswordEmail } from '@/lib/data/customer';

import { Modal } from '../Modal/Modal';

export const ProfilePassword = ({ user }: { user: HttpTypes.StoreCustomer }) => {
  const t = useTranslations('auth');
  const [showForm, setShowForm] = useState(false);

  const handleSendResetPasswordEmail = async () => {
    const res = await sendResetPasswordEmail(user.email);
    if (res.success) {
      setShowForm(false);
    }
  };

  return (
    <>
      <Card className="mt-8 flex items-center justify-between bg-secondary p-4">
        <Heading
          level="h2"
          className="heading-sm uppercase"
        >
          {t('password_heading')}
        </Heading>
        <Button
          variant="tonal"
          className="flex items-center gap-2 font-semibold uppercase"
          onClick={() => setShowForm(true)}
        >
          {t('change_password_button')}
        </Button>
      </Card>
      <Card className="p-0">
        <div className="p-4">
          <p className="label-md text-secondary">{t('current_password_label')}</p>
          <p className="label-lg text-primary">****************</p>
        </div>
        <Divider />
        <div className="p-4">
          <p className="label-md flex items-center gap-4 text-secondary">
            <InfoIcon
              size={18}
              className="text-secondary"
            />
            {t('password_security_tip')}
          </p>
        </div>
      </Card>
      {showForm && (
        <Modal
          heading={t('change_password_button')}
          onClose={() => setShowForm(false)}
        >
          <div className="flex justify-center p-4">
            <Button
              className="px-6 py-3 !font-semibold uppercase"
              onClick={handleSendResetPasswordEmail}
            >
              {t('send_reset_email_button')}
            </Button>
          </div>
          {/* <ProfilePasswordForm user={user} /> */}
        </Modal>
      )}
    </>
  );
};
