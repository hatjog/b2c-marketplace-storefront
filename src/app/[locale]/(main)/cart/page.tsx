import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Cart } from '@/components/sections';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('page');
  return {
    title: t('cart_title'),
    description: t('cart_description')
  };
}

export default async function CartPage({}) {
  const t = await getTranslations('page');
  return (
    <main id="main-content" className="container grid grid-cols-12">
      <Suspense fallback={<>{t('loading')}</>}>
        <Cart />
      </Suspense>
    </main>
  );
}
