import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const source = read("src/components/organisms/Header/Header.tsx");

// AC1 + AC4: warunkowe renderowanie logo (nie statyczny fallback)
test("Header: nie używa statycznego fallbacku /Logo.svg", () => {
  assert.doesNotMatch(source, /['"]\/Logo\.svg['"]/);
});

test("Header: logo renderowane warunkowo gdy marketLogoUrl truthy", () => {
  assert.match(source, /\{marketLogoUrl &&/);
});

// AC1: src logo pochodzi z marketLogoUrl (nie logoSrc)
test("Header: Image src to marketLogoUrl, nie logoSrc", () => {
  assert.match(source, /src=\{marketLogoUrl\}/);
  assert.doesNotMatch(source, /const logoSrc/);
});

// AC2: nazwa marketu renderowana jako span z typografią
test("Header: nazwa marketu wyświetlana w span z font-bold text-xl", () => {
  assert.match(source, /marketName \?/);
  assert.match(source, /className="font-bold text-xl"/);
  assert.match(source, /\{marketName\}/);
});

// AC4 edge case: fallback "Home" gdy brak logo i nazwy
test("Header: fallback 'Home' gdy brak marketLogoUrl i marketName", () => {
  assert.match(source, /!marketLogoUrl/);
  assert.match(source, /getTranslations\('header'\)/);
  assert.match(source, /tHeader\('home_fallback'\)/);
});

// AC3: logo i nazwa opakowane w link do strony głównej
test("Header: LocalizedClientLink z href='/'", () => {
  assert.match(source, /href="\/"/);
  assert.match(source, /data-testid="header-logo-link"/);
});

// AC4: fallback bez logo — Image NIE renderowany gdy brak logo (warunkowy)
test("Header: Image renderowany tylko warunkowo (nie bezwarunkowo)", () => {
  // Image jest wewnątrz {marketLogoUrl && ...}
  assert.match(source, /marketLogoUrl && \(\s*<Image/s);
});

// AC6: alt text używa nazwy marketu lub fallback 'Logo'
test("Header: alt logo to marketName lub 'Logo'", () => {
  assert.match(source, /alt=\{marketName \?\? ['"]Logo['"]\}/);
});

// AC3: layout linku to flex items-center gap-2
test("Header: LocalizedClientLink ma className flex items-center gap-2", () => {
  assert.match(source, /className="flex items-center gap-2"/);
});
