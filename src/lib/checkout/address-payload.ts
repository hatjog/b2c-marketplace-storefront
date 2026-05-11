export type CheckoutAddressInput = {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2: string;
  company: string;
  postal_code: string;
  city: string;
  country_code: string;
  province: string;
  phone: string;
};

export type CheckoutAddressPayload = {
  shipping_address: CheckoutAddressInput;
  billing_address?: CheckoutAddressInput;
  email: string;
  same_as_billing: boolean;
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export function checkoutAddressPayloadFromFormData(formData: FormData): CheckoutAddressPayload {
  const sameAsBillingValue = readString(formData, 'same_as_billing');
  const shipping_address: CheckoutAddressInput = {
    first_name: readString(formData, 'shipping_address.first_name'),
    last_name: readString(formData, 'shipping_address.last_name'),
    address_1: readString(formData, 'shipping_address.address_1'),
    address_2: readString(formData, 'shipping_address.address_2'),
    company: readString(formData, 'shipping_address.company'),
    postal_code: readString(formData, 'shipping_address.postal_code'),
    city: readString(formData, 'shipping_address.city'),
    country_code: readString(formData, 'shipping_address.country_code'),
    province: readString(formData, 'shipping_address.province'),
    phone: readString(formData, 'shipping_address.phone')
  };

  return {
    shipping_address,
    email: readString(formData, 'email'),
    same_as_billing:
      sameAsBillingValue === '' || sameAsBillingValue === 'on' || sameAsBillingValue === 'true'
  };
}
