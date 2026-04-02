import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '404 – Strona nie istnieje',
  description: 'Przepraszamy, ta strona nie istnieje lub została przeniesiona.'
};

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '48px 24px',
        backgroundColor: '#FAF8F5',
        fontFamily: 'inherit'
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

        <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#1A1A1A', margin: 0 }}>
          Strona nie istnieje
        </h1>

        <p style={{ fontSize: '16px', color: '#1A1A1A', margin: 0, lineHeight: '1.6' }}>
          Przepraszamy, ta strona nie istnieje lub została przeniesiona. Sprawdź adres
          URL lub wróć na stronę główną.
        </p>

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
  );
}
