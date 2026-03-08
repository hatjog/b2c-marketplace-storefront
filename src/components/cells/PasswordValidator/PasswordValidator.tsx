'use client';

import { useEffect, useState } from 'react';

import { CheckCircle } from '@medusajs/icons';
import { useTranslations } from 'next-intl';

import { Card } from '@/components/atoms';
import { cn } from '@/lib/utils';

function validatePassword(password: string) {
  const errors = {
    tooShort: password.length < 8,
    noLower: !/[a-z]/.test(password),
    noUpper: !/[A-Z]/.test(password),
    noDigitOrSymbol: !/[0-9!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(password)
  };

  return {
    isValid: !Object.values(errors).some(Boolean),
    errors
  };
}

export const PasswordValidator = ({
  password,
  setError
}: {
  password: string;
  setError: (error: any) => void;
}) => {
  const t = useTranslations('auth');
  const [newPasswordError, setNewPasswordError] = useState({
    isValid: false,
    lower: false,
    upper: false,
    '8chars': false,
    symbolOrDigit: false
  });

  useEffect(() => {
    const validation = validatePassword(password);

    setError({
      isValid: validation.isValid,
      lower: validation.errors.noLower,
      upper: validation.errors.noUpper,
      '8chars': validation.errors.tooShort,
      symbolOrDigit: validation.errors.noDigitOrSymbol
    });
    setNewPasswordError({
      isValid: validation.isValid,
      lower: validation.errors.noLower,
      upper: validation.errors.noUpper,
      '8chars': validation.errors.tooShort,
      symbolOrDigit: validation.errors.noDigitOrSymbol
    });
  }, [password]);
  return (
    <Card className="p-4">
      <p
        className={cn(
          'label-md mb-2 flex items-center gap-2',
          newPasswordError['8chars'] ? 'text-red-700' : 'text-green-700'
        )}
      >
        <CheckCircle /> {t('password_req_8chars')}
      </p>
      <p
        className={cn(
          'label-md mb-2 flex items-center gap-2',
          newPasswordError['lower'] ? 'text-red-700' : 'text-green-700'
        )}
      >
        <CheckCircle /> {t('password_req_lowercase')}
      </p>
      <p
        className={cn(
          'label-md mb-2 flex items-center gap-2',
          newPasswordError['upper'] ? 'text-red-700' : 'text-green-700'
        )}
      >
        <CheckCircle /> {t('password_req_uppercase')}
      </p>
      <p
        className={cn(
          'label-md mb-2 flex items-center gap-2',
          newPasswordError['symbolOrDigit'] ? 'text-red-700' : 'text-green-700'
        )}
      >
        <CheckCircle /> {t('password_req_symbol')}
      </p>
    </Card>
  );
};
