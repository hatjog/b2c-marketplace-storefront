// Visual regression spec — W6-04 cookie banner (Story 3.1 Wave 6 chrome full impl).
// Variants × 3 breakpoints (375/768/1280) × 4 locales (pl/en/ua/de).
// Run: playwright test tests/visual-regression/w6-04-cookie-banner.spec.ts --update-snapshots
// NOTE: baseline capture wymaga component preview harness (Story 3.1 T9);
//       bez niego cells SKIP. Sprint 2 mid-checkpoint sample-aware.

import { defineWave6Spec } from './wave6.shared';

defineWave6Spec('w6-04-cookie-banner');
