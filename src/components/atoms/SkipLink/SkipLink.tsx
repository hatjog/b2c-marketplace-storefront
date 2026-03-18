/**
 * SkipLink — keyboard accessibility landmark (AC-2)
 *
 * Rendered visually hidden until focused. On focus it becomes visible,
 * allowing keyboard users to skip the header navigation and jump directly
 * to the main content region identified by `id="main-content"`.
 *
 * Usage: place as the very first element inside <body> (before <Header>).
 * Pass a translated label from the parent server component.
 */

interface SkipLinkProps {
  label: string;
}

export function SkipLink({ label }: SkipLinkProps) {
  return (
    <a
      href="#main-content"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[9999] focus-visible:rounded-sm focus-visible:bg-action focus-visible:px-4 focus-visible:py-2 focus-visible:text-action-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
    >
      {label}
    </a>
  );
}
