'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';

import {
  addressSchema,
  profileSettingsSchema,
  reviewDeleteSchema,
  reviewMutationSchema,
  returnRequestSchema,
  securitySettingsSchema,
  validateReturnFiles,
} from '@/lib/account/account-write-schemas';
import {
  addCustomerAddress,
  deleteCustomerAddress,
  sendResetPasswordEmail,
  updateCustomer,
  updateCustomerAddress,
} from '@/lib/data/customer';
import { getAuthHeaders } from '@/lib/data/cookies';
import { createReturnRequest } from '@/lib/data/orders';
import { resolveMedusaBackendUrl } from '@/lib/env';

type ActionStatus = 'idle' | 'success' | 'error';

export interface AccountActionState {
  status: ActionStatus;
  messageKey?: string;
  fieldErrors?: Record<string, string>;
  redirectPath?: string;
}

const INITIAL_STATE: AccountActionState = {
  status: 'idle',
};

const MEDUSA_BACKEND_URL = resolveMedusaBackendUrl();

function zodErrorsToFieldMap(error: z.ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const field = String(issue.path[0] ?? 'form');
    if (!acc[field]) {
      acc[field] = issue.message;
    }
    return acc;
  }, {});
}

function withFieldErrors(error: z.ZodError): AccountActionState {
  return {
    status: 'error',
    messageKey: 'common.form_error',
    fieldErrors: zodErrorsToFieldMap(error),
  };
}

function buildAddressFormData(parsed: z.infer<typeof addressSchema>) {
  const formData = new FormData();

  if (parsed.addressId) {
    formData.set('addressId', parsed.addressId);
  }

  formData.set('address_name', parsed.addressName);
  formData.set('first_name', parsed.firstName);
  formData.set('last_name', parsed.lastName);
  formData.set('company', parsed.company);
  formData.set('address_1', parsed.address1);
  formData.set('city', parsed.city);
  formData.set('country_code', parsed.countryCode);
  formData.set('postal_code', parsed.postalCode);
  formData.set('province', parsed.province);
  formData.set('phone', parsed.phone);

  return formData;
}

async function mutateReview(method: 'PATCH' | 'DELETE', reviewId: string, payload?: Record<string, unknown>) {
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
    'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
  };

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/reviews/${reviewId}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    throw new Error('written_reviews.form.errors.generic');
  }
}

export async function submitReturnRequest(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = returnRequestSchema.safeParse({
    orderId: formData.get('orderId'),
    reasonId: formData.get('reasonId'),
    comment: formData.get('comment'),
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  const files = formData
    .getAll('photos')
    .filter((value): value is File => value instanceof File && value.size > 0);
  const fileError = validateReturnFiles(files);

  if (fileError) {
    return {
      status: 'error',
      messageKey: 'common.form_error',
      fieldErrors: { photos: fileError },
    };
  }

  const response = await createReturnRequest({
    order_id: parsed.data.orderId,
    order_return_reason_id: parsed.data.reasonId,
    customer_note: parsed.data.comment,
    attachment_names: files.map((file) => file.name),
  });

  if (response?.error) {
    return {
      status: 'error',
      messageKey: 'return_request.errors.generic',
    };
  }

  revalidatePath('/user/orders');
  revalidatePath(`/user/orders/${parsed.data.orderId}/return`);
  revalidatePath(`/user/orders/${parsed.data.orderId}/request-success`);

  return {
    status: 'success',
    messageKey: 'return_request.success.submitted',
    redirectPath: `/user/orders/${parsed.data.orderId}/request-success`,
  };
}

export async function submitAddress(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = addressSchema.safeParse({
    addressId: formData.get('addressId') || undefined,
    addressName: formData.get('addressName'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    company: formData.get('company'),
    address1: formData.get('address1'),
    city: formData.get('city'),
    countryCode: formData.get('countryCode'),
    postalCode: formData.get('postalCode'),
    province: formData.get('province'),
    phone: formData.get('phone'),
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  const payload = buildAddressFormData(parsed.data);
  const result = parsed.data.addressId
    ? await updateCustomerAddress(payload)
    : await addCustomerAddress(payload);

  if (!result?.success) {
    return {
      status: 'error',
      messageKey: 'addresses.form.errors.generic',
    };
  }

  revalidatePath('/user/addresses');

  return {
    status: 'success',
    messageKey: parsed.data.addressId ? 'addresses.form.success.updated' : 'addresses.form.success.created',
  };
}

export async function deleteAddressAction(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const addressId = formData.get('addressId');

  if (typeof addressId !== 'string' || addressId.length === 0) {
    return {
      status: 'error',
      messageKey: 'addresses.form.errors.generic',
      fieldErrors: { addressId: 'addresses.form.errors.generic' },
    };
  }

  await deleteCustomerAddress(addressId);
  revalidatePath('/user/addresses');

  return {
    status: 'success',
    messageKey: 'addresses.form.success.deleted',
  };
}

export async function updateWrittenReview(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = reviewMutationSchema.safeParse({
    reviewId: formData.get('reviewId'),
    orderId: formData.get('orderId'),
    rating: formData.get('rating'),
    note: formData.get('note'),
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  try {
    await mutateReview('PATCH', parsed.data.reviewId, {
      rating: parsed.data.rating,
      customer_note: parsed.data.note,
      order_id: parsed.data.orderId,
    });
  } catch {
    return {
      status: 'error',
      messageKey: 'written_reviews.form.errors.generic',
    };
  }

  revalidatePath('/user/reviews');
  revalidatePath('/user/reviews/written');

  return {
    status: 'success',
    messageKey: 'written_reviews.form.success.updated',
  };
}

export async function deleteWrittenReview(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = reviewDeleteSchema.safeParse({
    reviewId: formData.get('reviewId'),
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  try {
    await mutateReview('DELETE', parsed.data.reviewId);
  } catch {
    return {
      status: 'error',
      messageKey: 'written_reviews.form.errors.generic',
    };
  }

  revalidatePath('/user/reviews');
  revalidatePath('/user/reviews/written');

  return {
    status: 'success',
    messageKey: 'written_reviews.form.success.deleted',
  };
}

export async function updateProfileSettings(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = profileSettingsSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    locale: formData.get('locale'),
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  try {
    await updateCustomer({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
    });
  } catch {
    return {
      status: 'error',
      messageKey: 'settings.profile.errors.generic',
    };
  }

  revalidatePath('/user/settings');

  return {
    status: 'success',
    messageKey: 'settings.profile.success.updated',
  };
}

export async function updateSecuritySettings(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = securitySettingsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  const result = await sendResetPasswordEmail(parsed.data.email);

  if (!result?.success) {
    return {
      status: 'error',
      messageKey: 'settings.security.errors.generic',
    };
  }

  return {
    status: 'success',
    messageKey: 'settings.security.success.reset_email_sent',
  };
}

export async function updateNotificationSettings(
  _previous: AccountActionState = INITIAL_STATE,
  _formData: FormData
): Promise<AccountActionState> {
  revalidatePath('/user/settings');

  return {
    status: 'success',
    messageKey: 'settings.notifications.success.request_received',
  };
}

export async function updatePaymentSettings(
  _previous: AccountActionState = INITIAL_STATE,
  _formData: FormData
): Promise<AccountActionState> {
  revalidatePath('/user/settings');

  return {
    status: 'success',
    messageKey: 'settings.payments.success.request_received',
  };
}

export async function submitPrivacyRequest(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const requestType = formData.get('requestType');

  if (requestType !== 'export' && requestType !== 'delete') {
    return {
      status: 'error',
      messageKey: 'settings.privacy.errors.generic',
    };
  }

  revalidatePath('/user/settings');

  return {
    status: 'success',
    messageKey:
      requestType === 'export'
        ? 'settings.privacy.success.export_request_received'
        : 'settings.privacy.success.delete_request_received',
  };
}

export const accountActionInitialState = INITIAL_STATE;
