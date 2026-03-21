'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useTranslations } from 'next-intl'

interface VoucherQrCodeProps {
  code: string
  size?: number
  className?: string
  'data-testid'?: string
}

export function VoucherQrCode({
  code,
  size = 128,
  className,
  'data-testid': testId = 'qr-code',
}: VoucherQrCodeProps) {
  const t = useTranslations('voucher')
  if (!code) return null

  const normalized = code.toUpperCase().replace(/[-_.\s]/g, '')

  if (!normalized) return null

  return (
    <div data-testid={testId} className={className} role="img" aria-label={t('qr_code_aria_label')}>
      <span className="text-xs text-ui-fg-subtle">{t('qr_code_label')}</span>
      <QRCodeSVG value={normalized} size={size} level="M" aria-hidden="true" />
    </div>
  )
}
