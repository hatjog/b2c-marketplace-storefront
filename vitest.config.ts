/**
 * vitest.config.ts
 *
 * Vitest pipeline only. The Next.js build path (SWC + tsconfig.jsx="preserve")
 * is unaffected by these esbuild settings — this config exists solely so unit
 * tests can call function components and inspect returned JSX without an
 * undefined `React` global. Do NOT align this with tsconfig.json's
 * `jsx: "preserve"` — Next.js needs preserve for SWC, vitest needs automatic
 * for esbuild (review-2 INFO/2 documented divergence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// When running inside a git worktree the submodule's node_modules may not be
// installed. Fall back to the main GP/storefront installation so that vitest
// can resolve React and other dependencies.
const fallbackModules = '/home/robsz/prj/GP/GP/storefront/node_modules';
const localModules = path.resolve(__dirname, 'node_modules');
const usesFallback = !fs.existsSync(path.join(localModules, 'react')) && fs.existsSync(fallbackModules);

// Build react/react-dom aliases that point to the concrete pnpm package paths
// (direct symlink resolution avoids Node's module-directory search which only
// looks at ancestors of the *requiring* file, not of the config file).
const reactAliases = usesFallback
  ? {
      react: path.join(fallbackModules, 'react'),
      'react-dom': path.join(fallbackModules, 'react-dom'),
      'react/jsx-runtime': path.join(fallbackModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': path.join(fallbackModules, 'react/jsx-dev-runtime'),
    }
  : {};

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub the `server-only` build guard so server modules (and their
      // transitive importers) are unit-testable under vitest's node env, which
      // has no RSC boundary. Without this, importing such modules throws
      // "This module cannot be imported from a Client Component module."
      'server-only': path.resolve(__dirname, './src/test/stubs/server-only.ts'),
      ...reactAliases,
    },
  },
  // v1.7.0 Story 2.1 review fix: explicit JSX automatic transform so component
  // tests do not need to import `React` and can call function components
  // directly (the previous default left tests in classic JSX transform mode
  // referencing an undefined `React` global at runtime, which caused the
  // pre-existing Skeleton.test.tsx to silently fail and prevented adding
  // Button/Badge/Chip tests for the AC3 state-coverage finding).
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    env: {
      MEDUSA_BACKEND_URL: 'http://localhost:9002',
      STOREFRONT_BASE_URL: 'http://localhost:3001',
    },
  },
} as any);
