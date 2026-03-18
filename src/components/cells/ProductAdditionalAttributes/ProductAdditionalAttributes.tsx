import { getTranslations } from 'next-intl/server';

import { ProductPageAccordion } from '@/components/molecules';
import type { AdditionalAttributeProps } from '@/types/product';

export const ProductAdditionalAttributes = async ({
  attributes
}: {
  attributes: AdditionalAttributeProps[];
}) => {
  if (!attributes?.length) return null;

  const t = await getTranslations('products');
  const nonEmptyAttributes = attributes.filter(attribute => !!attribute && attribute.id);

  return (
    <ProductPageAccordion
      heading={t('attributes_heading')}
      defaultOpen={false}
      data-testid="product-additional-attributes-section"
    >
      {nonEmptyAttributes.map(attribute => (
        <div
          key={attribute.id}
          className="label-md grid grid-cols-2 rounded-sm border text-center"
          data-testid={`product-attribute-${attribute.attribute?.name?.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="border-r py-3">{attribute.attribute?.name}</div>
          <div className="py-3">{attribute.value}</div>
        </div>
      ))}
    </ProductPageAccordion>
  );
};
