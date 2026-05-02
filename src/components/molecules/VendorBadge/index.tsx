'use client'

import Image from 'next/image'
import Link from 'next/link'

import { ArrowRightIcon } from '@/icons'
import { getInitialsFromName, getAvatarTextColor, getColorFromHandle, produktPlural } from '@/lib/helpers/vendor-badge'

export interface VendorBadgeProps {
  vendor: {
    name: string
    handle: string
    photoUrl: string | null
    productCount: number
  }
  variant: 'pdp' | 'header'
}

/**
 * VendorBadge — shows the salon avatar + name (pdp variant) or avatar only (header variant).
 * Always links to /sellers/[handle] (canonical EN route slug; PL display copy "salon" preserved in UI text).
 */
export function VendorBadge({ vendor, variant }: VendorBadgeProps) {
  const avatarSize = variant === 'header' ? 72 : 48
  const initials = getInitialsFromName(vendor.name)
  const avatarColor = getColorFromHandle(vendor.handle)
  const avatarTextColor = getAvatarTextColor(avatarColor)

  return (
    <Link
      href={`/sellers/${vendor.handle}`}
      aria-label={`Profil salonu ${vendor.name}`}
      className="inline-flex items-center gap-3"
    >
      {/* Avatar container — initials rendered behind image as CSS fallback */}
      <div
        style={{ width: avatarSize, height: avatarSize }}
        className="relative flex-shrink-0"
      >
        {/* Initials fallback — always present; covered by image when it loads */}
        <div
          style={{
            width: avatarSize,
            height: avatarSize,
            backgroundColor: avatarColor,
          }}
          className="absolute inset-0 rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          <span
            className="font-[--font-display] font-semibold"
            style={{ color: avatarTextColor, fontSize: Math.round(avatarSize * 0.35) }}
          >
            {initials}
          </span>
        </div>

        {/* Image — overlays initials; hides itself on load error */}
        {vendor.photoUrl !== null && (
          <Image
            src={vendor.photoUrl}
            alt={vendor.name}
            width={avatarSize}
            height={avatarSize}
            className="absolute inset-0 rounded-full object-cover"
            onError={e => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
      </div>

      {variant === 'pdp' && (
        <>
          <div className="flex flex-col flex-1">
            <span className="font-medium">{vendor.name}</span>
            <span className="text-sm">{produktPlural(vendor.productCount)}</span>
          </div>
          <ArrowRightIcon size={20} />
        </>
      )}
    </Link>
  )
}
