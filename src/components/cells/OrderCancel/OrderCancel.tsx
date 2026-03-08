'use client';

import { useState } from 'react';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Button, Checkbox, Divider } from '@/components/atoms';
import { Modal } from '@/components/molecules';
import { convertToLocale } from '@/lib/helpers/money';
import { cn } from '@/lib/utils';

export const OrderCancel = ({ order }: { order: any }) => {
  const t = useTranslations('orders');
  const [open, setOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  const handleCancel = () => {
    console.log('cancel');
  };

  const handleSelectItem = (item: any) => {
    if (selectedItems.includes(item)) {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleChangeQuantity = (item: any, quantity: number) => {
    const itemline = selectedItems.find(i => i.id === item.id);
    if (itemline) {
      itemline.quantity += quantity;
      setSelectedItems([...selectedItems]);
    }
  };

  return (
    <>
      <div className="items-center justify-between md:flex">
        <div className="mb-4 md:mb-0">
          <h2 className="label-lg uppercase text-primary">{t('cancel_heading')}</h2>
          <p className="label-md max-w-sm text-secondary">
            {t('cancel_description')}
          </p>
        </div>
        <Button
          variant="tonal"
          className="uppercase"
          onClick={() => setOpen(true)}
        >
          {t('cancel_button')}
        </Button>
      </div>
      {open && (
        <Modal
          heading={t('select_items')}
          onClose={() => setOpen(false)}
        >
          <div>
            <ul className="px-4">
              {order.items.map((item: any) => {
                const isSelected = selectedItems.includes(item);
                const itemline = selectedItems.find(i => i.id === item.id);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      'mb-2 flex items-center gap-4 rounded-sm p-4',
                      isSelected && 'bg-secondary/70'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleSelectItem(item)}
                    />
                    <div className="flex w-full gap-4">
                      <div className="w-16 rounded-sm border">
                        {item.thumbnail ? (
                          <Image
                            src={item.thumbnail}
                            alt={item.subtitle}
                            width={60}
                            height={60}
                            className="rounded-sm"
                          />
                        ) : (
                          <Image
                            src={'/images/placeholder.svg'}
                            alt={item.subtitle}
                            width={60}
                            height={60}
                            className="scale-75 opacity-25"
                          />
                        )}
                      </div>
                      <div className="grid w-full grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <p className="label-md w-full truncate text-primary">{item.subtitle}</p>
                          <p className="label-sm w-full truncate text-secondary">{item.title}</p>
                        </div>
                        <div className="flex items-center justify-center">
                          {isSelected && (
                            <div className="mt-2 flex items-center">
                              <Button
                                variant="text"
                                className="!hover:bg-secondary flex h-8 w-8 items-center justify-center !bg-transparent"
                                disabled={item.quantity === 1}
                                onClick={() => handleChangeQuantity(item, -1)}
                              >
                                -
                              </Button>
                              <div className="flex h-8 w-8 items-center justify-center rounded-sm border bg-primary text-center font-medium text-primary">
                                {item.quantity}
                              </div>
                              <Button
                                variant="text"
                                className="!hover:bg-secondary flex h-8 w-8 items-center justify-center !bg-transparent"
                                disabled={item.quantity === itemline.quantity}
                                onClick={() => handleChangeQuantity(item, 1)}
                              >
                                +
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-end">
                          <p className="label-lg text-primary">
                            {convertToLocale({
                              amount: item.total,
                              currency_code: order.currency_code
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Divider className="my-4" />
            <div className="px-4">
              <Button
                className="w-full uppercase"
                onClick={handleCancel}
              >
                {t('request_cancellation')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
