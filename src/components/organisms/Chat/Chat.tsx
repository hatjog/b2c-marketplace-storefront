'use client';

import { useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { ChatBox } from '@/components/cells/ChatBox/ChatBox';
import { Modal } from '@/components/molecules';
import { MessageIcon } from '@/icons';
import type { SellerProps } from '@/types/seller';

const TALKJS_APP_ID = process.env.NEXT_PUBLIC_TALKJS_APP_ID || '';

export const Chat = ({
  user,
  seller,
  buttonClassNames,
  icon,
  product,
  subject,
  order_id,
  variant = 'tonal',
  buttonSize = 'small'
}: {
  user: HttpTypes.StoreCustomer | null;
  seller: SellerProps;
  buttonClassNames?: string;
  icon?: boolean;
  product?: HttpTypes.StoreProduct;
  subject?: string;
  order_id?: string;
  variant?: 'tonal' | 'filled';
  buttonSize?: 'small' | 'large';
}) => {
  const t = useTranslations('products');
  const [modal, setModal] = useState(false);

  if (!TALKJS_APP_ID) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setModal(true)}
        className={buttonClassNames}
        size={buttonSize}
      >
        {icon ? <MessageIcon size={20} /> : t('write_to_seller')}
      </Button>
      {modal && (
        <Modal
          heading={t('chat_heading')}
          onClose={() => setModal(false)}
        >
          <div className="px-4">
            <ChatBox
              order_id={order_id}
              product_id={product?.id}
              subject={subject || product?.title || null}
              currentUser={{
                id: user?.id || '',
                name: `${user?.first_name} ${user?.last_name}` || '',
                email: user?.email || null,
                photoUrl: '/talkjs-placeholder.jpg',
                role: 'customer'
              }}
              supportUser={{
                id: seller?.id || '',
                name: seller?.name || '',
                email: seller?.email || null,
                photoUrl: seller.photo || '/talkjs-placeholder.jpg',
                role: 'seller'
              }}
            />
          </div>
        </Modal>
      )}
    </>
  );
};
