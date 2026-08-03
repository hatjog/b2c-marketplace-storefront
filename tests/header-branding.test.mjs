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

// AC1: skonfigurowany asset logo jest przekazywany do lockupu
test("Header: logoSrc pochodzi z marketLogoUrl", () => {
  assert.match(source, /logoSrc=\{marketLogoUrl\}/);
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
