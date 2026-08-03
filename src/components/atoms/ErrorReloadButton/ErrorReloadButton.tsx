'use client';

/**
 * Story v1.8.0-7-5: ErrorReloadButton — client-side reload CTA for offline/error surfaces.
 *
 * Extracted as a client island so the parent page.tsx can remain a server component.
 */

interface ErrorReloadButtonProps {
  label: string;
}

export function ErrorReloadButton({ label }: ErrorReloadButtonProps) {
  return (
    <button
      type="button"
      data-testid="error-cta-retry"
      onClick={() => window.location.reload()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 28px',
        background: 'var(--bg-action, #907032)',
        color: 'var(--text-on-action, #FAF8F5)',
        border: 'none',
        borderRadius: 'var(--radius-sm, 4px)',
        fontFamily: 'Inter, sans-serif',
        fontSize: '0.9375rem',
        fontWeight: 500,
        cursor: 'pointer',
        minHeight: '44px',
        minWidth: '44px'
      }}
    >
      {label}
    </button>
  );
}
