/**
 * SkipLink — keyboard accessibility landmark (AC-2)
 *
 * Rendered visually hidden until focused. On focus it becomes visible,
 * allowing keyboard users to skip the header navigation and jump directly
 * to the main content region identified by `id="main-content"`.
 *
 * Usage: place as the very first element inside <body> (before <Header>).
 */

interface SkipLinkProps {
  label?: string;
}

export function SkipLink({ label = 'Skip to main content' }: SkipLinkProps) {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-sm focus:bg-action focus:px-4 focus:py-2 focus:text-action-on-primary focus:outline-none focus:ring-2 focus:ring-[--accent]"
    >
      {label}
    </a>
  );
}
