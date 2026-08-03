'use client';

import type React from 'react';
import type { PropsWithChildren } from 'react';

import { CartProvider } from '@/components/providers';
import type { Cart } from '@/types/cart';

interface ProvidersProps extends PropsWithChildren {
  cart: Cart | null;
}

export function Providers({ children, cart }: ProvidersProps) {
  return <CartProvider cart={cart}>{children}</CartProvider>;
}
