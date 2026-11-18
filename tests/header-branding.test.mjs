import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const source = read("src/components/organisms/Header/Header.tsx");

// AC1 + AC4: logo nie wraca do historycznego fallbacku /Logo.svg
test("Header: nie używa statycznego fallbacku /Logo.svg", () => {
  assert.doesNotMatch(source, /['"]\/Logo\.svg['"]/);
});

test("Header: używa wspólnego komponentu LogoLockup", () => {
  assert.match(source, /LogoLockup/);
  assert.match(source, /data-testid="header-logo-link"/);
});

// DW-15-326: AC1 superseded by 36578710d (2026-06-11, PO review P6): the
// header renders the BRAND lockup (variant="light"), not the market-configured
// logo asset. The old `logoSrc={marketLogoUrl}` wiring was removed on purpose;
// the contract now guards against it coming back.
test("Header: renderuje brandowy LogoLockup, nie logo z konfiguracji marketu", () => {
  assert.match(source, /<LogoLockup[\s\S]*?variant="light"/);
  assert.doesNotMatch(source, /logoSrc=/);
  assert.doesNotMatch(source, /marketLogoUrl/);
});

// AC2/AC3: nazwa systemowa marketu nie jest wordmarkiem brandowym
test("Header: nie renderuje marketName jako tekstowego brandu", () => {
  assert.doesNotMatch(source, /marketName \?/);
  assert.doesNotMatch(source, /\{marketName\}/);
  assert.doesNotMatch(source, /home_fallback/);
});

// AC3: layout linku pozostaje zgodny z dotychczasowym slotem
test("Header: LogoLockup ma className flex items-center gap-2", () => {
  assert.match(source, /className="flex items-center gap-2"/);
});
