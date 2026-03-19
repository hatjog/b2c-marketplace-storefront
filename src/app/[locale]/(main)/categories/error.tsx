'use client'

import { useEffect } from 'react'

export default function CategoriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Categories error:', error)
  }, [error])

  return (
    <main id="main-content" className="container py-24 text-center">
      <h2 className="text-2xl font-bold mb-4">Wystąpił błąd</h2>
      <p className="text-base text-gray-600 mb-8">
        Nie udało się załadować kategorii. Jeśli problem się powtarza, spróbuj
        później.
      </p>
      <button
        onClick={reset}
        className="rounded bg-black px-6 py-3 text-white hover:bg-gray-800 transition-colors"
      >
        Spróbuj ponownie
      </button>
    </main>
  )
}
