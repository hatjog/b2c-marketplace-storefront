'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { HeartFilledIcon, HeartIcon } from '@/icons';
import { addWishlistItem, removeWishlistItem } from '@/lib/data/wishlist';
import { toast } from '@/lib/helpers/toast';
import type { Wishlist } from '@/types/wishlist';

export const WishlistButton = ({
  productId,
  wishlist,
  user
}: {
  productId: string;
  wishlist?: Wishlist;
  user?: HttpTypes.StoreCustomer | null;
}) => {
  const [isWishlistAdding, setIsWishlistAdding] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(
    wishlist?.products?.some(item => item.id === productId)
  );
  const t = useTranslations('wishlist');

  useEffect(() => {
    setIsWishlisted(wishlist?.products?.some(item => item.id === productId));
  }, [wishlist, productId]);

  if (!user) {
    return null;
  }

  const handleAddToWishlist = async () => {
    try {
      setIsWishlistAdding(true);
      await addWishlistItem({
        reference_id: productId,
        reference: 'product'
      });
    } catch (error) {
      toast.error({
        title: t('add_failed'),
        description: error instanceof Error ? error?.message : t('error_generic')
      });
    } finally {
      setIsWishlistAdding(false);
    }
  };

  const handleRemoveFromWishlist = async () => {
    try {
      setIsWishlistAdding(true);

      await removeWishlistItem({
        product_id: productId
      });
    } catch (error) {
      toast.error({
        title: t('remove_failed'),
        description: error instanceof Error ? error?.message : t('error_generic')
      });
    } finally {
      setIsWishlistAdding(false);
    }
  };
  return (
    <Button
      onClick={isWishlisted ? () => handleRemoveFromWishlist() : () => handleAddToWishlist()}
      variant="tonal"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/16 bg-[rgba(255,255,255,0.9)] p-0 text-primary hover:bg-white"
      loading={isWishlistAdding}
      disabled={isWishlistAdding}
    >
      {isWishlisted ? <HeartFilledIcon size={20} /> : <HeartIcon size={20} />}
    </Button>
  );
};
