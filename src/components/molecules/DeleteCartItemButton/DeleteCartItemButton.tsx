'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { useCartContext } from '@/components/providers';
import { BinIcon } from '@/icons';
import { toast } from '@/lib/helpers/toast';

export const DeleteCartItemButton = ({ id, disabled }: { id: string; disabled?: boolean }) => {
  const t = useTranslations('cart');
  const { removeCartItem, isRemovingItem } = useCartContext();

  const handleDelete = async (id: string) => {
    try {
      await removeCartItem(id);
    } catch (error) {
      console.error('Error deleting cart item:', error);
      toast.error({
        title: t('remove_item_failed')
      });
    }
  };

  const isBtnDisabled = isRemovingItem || disabled || !id;

  return (
    <Button
      variant="text"
      className="flex h-10 w-10 items-center justify-center p-0"
      onClick={() => handleDelete(id)}
      loading={isRemovingItem}
      disabled={isBtnDisabled}
      aria-label={t('remove_item_aria')}
    >
      <BinIcon size={20} />
    </Button>
  );
};
