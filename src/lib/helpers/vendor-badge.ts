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

/** Deterministic color derived from vendor handle string. */
export function getColorFromHandle(handle: string): string {
  const hash = handle.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

function getRelativeLuminance(channel: number) {
  const normalized = channel / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function getContrastRatio(luminanceA: number, luminanceB: number) {
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

export function getAvatarTextColor(backgroundColor: string) {
  const { r, g, b } = hexToRgb(backgroundColor)
  const backgroundLuminance =
    0.2126 * getRelativeLuminance(r) +
    0.7152 * getRelativeLuminance(g) +
    0.0722 * getRelativeLuminance(b)

  const whiteLuminance = 1
  const darkTextLuminance =
    0.2126 * getRelativeLuminance(17) +
    0.7152 * getRelativeLuminance(24) +
    0.0722 * getRelativeLuminance(39)

  const whiteContrast = getContrastRatio(backgroundLuminance, whiteLuminance)
  const darkContrast = getContrastRatio(backgroundLuminance, darkTextLuminance)

  return darkContrast >= whiteContrast ? '#111827' : '#FFFFFF'
}

/** Polish plural for "produkt" (1 = produkt, 2-4 = produkty, 5+ = produktów). */
export function produktPlural(n: number): string {
  if (n === 1) return '1 produkt'
  const lastTwo = Math.abs(n) % 100
  const lastOne = lastTwo % 10
  if (lastOne >= 2 && lastOne <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${n} produkty`
  }
  return `${n} produktów`
}
