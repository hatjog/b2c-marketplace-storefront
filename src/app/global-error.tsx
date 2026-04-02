'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pl">
      <body
        style={{
          margin: 0,
          backgroundColor: '#FAF8F5',
          fontFamily: '"Funnel Display", sans-serif'
        }}
      >
        <div
          data-testid="global-error"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '48px 24px'
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              textAlign: 'center'
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="28" cy="28" r="26" stroke="#C5A059" strokeWidth="2" fill="white" />
              <text
                x="50%"
                y="50%"
                dominantBaseline="central"
                textAnchor="middle"
                fontSize="24"
                fontWeight="600"
                fill="#715828"
                fontFamily="inherit"
              >
                B
              </text>
            </svg>

            <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1A1A1A', margin: 0 }}>
              Coś poszło nie tak
            </h2>

            <p style={{ fontSize: '16px', color: '#1A1A1A', margin: 0, lineHeight: '1.6' }}>
              Przepraszamy, wystąpił nieoczekiwany błąd. Możesz spróbować ponownie lub
              wrócić na stronę główną.
            </p>

            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
            >
              <button
                type="button"
                onClick={() => reset()}
                data-testid="global-error-retry-button"
                style={{
                  backgroundColor: '#907032',
                  color: '#FAF8F5',
                  border: 'none',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontFamily: 'inherit'
                }}
              >
                Spróbuj ponownie
              </button>

              <Link
                href="/"
                style={{
                  color: '#907032',
                  fontSize: '16px',
                  textDecoration: 'underline',
                  fontWeight: '500'
                }}
              >
                Wróć na stronę główną
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
