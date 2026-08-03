// Vitest stub for the `server-only` package.
//
// `server-only` is a build-time guard that throws if a server module is pulled
// into a client bundle. Under vitest (environment: 'node') there is no RSC
// boundary, so importing the real package throws
// "This module cannot be imported from a Client Component module."
// Aliasing it to this empty module turns `import 'server-only'` into a no-op so
// server-only modules (and their transitive importers) are unit-testable.
export {}
