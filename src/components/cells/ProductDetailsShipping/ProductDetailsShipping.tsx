import { getTranslations } from 'next-intl/server';

import { ProductPageAccordion } from '@/components/molecules';
import LocalizedLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export const ProductDetailsShipping = async () => {
  const t = await getTranslations('products');

  return (
    <ProductPageAccordion
      heading={t('shipping_heading')}
      defaultOpen={false}
    >
      <div className="product-details">
        <p className="label-md text-secondary">
          {t('shipping_info')}
        </p>
        {/* TODO: Change to /regulamin when Story 2.8 delivers legal pages */}
        <LocalizedLink
          href="/polityka-prywatnosci"
          className="label-md mt-2 inline-block text-accent underline"
        >
          {t('shipping_policy_link')}
        </LocalizedLink>
      </div>
    </ProductPageAccordion>
  );
};
