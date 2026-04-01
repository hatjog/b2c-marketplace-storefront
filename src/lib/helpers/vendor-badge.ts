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
