'use client'

import Image from 'next/image'
import Link from 'next/link'

import { ArrowRightIcon } from '@/icons'

export interface VendorBadgeProps {
  vendor: {
    name: string
    handle: string
    photoUrl: string | null
    productCount: number
  }
  variant: 'pdp' | 'header'
}

/** Extract up to 2 uppercase initials from a display name. */
export function getInitialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const AVATAR_COLORS = [
  '#C8A96E',
  '#A87B3F',
  '#8B6914',
  '#D4B483',
  '#B8923A',
  '#9A7B2F',
  '#E0C47A',
  '#7A5F1A',
]

/** Deterministic color derived from vendor handle string. */
export function getColorFromHandle(handle: string): string {
  const hash = handle.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/**
 * VendorBadge — shows the salon avatar + name (pdp variant) or avatar only (header variant).
 * Always links to /salony/[handle] (Polish route contract).
 */
export function VendorBadge({ vendor, variant }: VendorBadgeProps) {
  const avatarSize = variant === 'header' ? 72 : 48
  const initials = getInitialsFromName(vendor.name)

  return (
    <Link
      href={`/salony/${vendor.handle}`}
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
            backgroundColor: getColorFromHandle(vendor.handle),
          }}
          className="absolute inset-0 rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          <span
            className="font-[--font-display] font-semibold text-white"
            style={{ fontSize: Math.round(avatarSize * 0.35) }}
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
            <span className="text-sm">{`${vendor.productCount} produktów`}</span>
          </div>
          <ArrowRightIcon size={20} />
        </>
      )}
    </Link>
  )
}
