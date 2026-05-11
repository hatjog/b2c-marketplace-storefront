import { describe, expect, it } from 'vitest';

import { checkoutAddressPayloadFromFormData } from '../address-payload';

describe('checkoutAddressPayloadFromFormData', () => {
  it('converts checkout form fields into a typed address payload', () => {
    const formData = new FormData();
    formData.set('shipping_address.first_name', 'Anna');
    formData.set('shipping_address.last_name', 'Nowak');
    formData.set('shipping_address.address_1', 'Testowa 17/5');
    formData.set('shipping_address.company', 'BonBeauty');
    formData.set('shipping_address.postal_code', '00-001');
    formData.set('shipping_address.city', 'Warszawa');
    formData.set('shipping_address.country_code', 'pl');
    formData.set('shipping_address.province', 'mazowieckie');
    formData.set('shipping_address.phone', '+48600000000');
    formData.set('email', 'anna@example.com');

    expect(checkoutAddressPayloadFromFormData(formData)).toEqual({
      shipping_address: {
        first_name: 'Anna',
        last_name: 'Nowak',
        address_1: 'Testowa 17/5',
        address_2: '',
        company: 'BonBeauty',
        postal_code: '00-001',
        city: 'Warszawa',
        country_code: 'pl',
        province: 'mazowieckie',
        phone: '+48600000000'
      },
      email: 'anna@example.com',
      same_as_billing: true
    });
  });

  it('preserves an explicit non-billing toggle for future split billing UI', () => {
    const formData = new FormData();
    formData.set('same_as_billing', 'false');

    expect(checkoutAddressPayloadFromFormData(formData).same_as_billing).toBe(false);
  });
});
