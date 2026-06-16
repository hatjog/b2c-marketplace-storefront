import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';

const appLocaleRoot = join(process.cwd(), 'src', 'app', '[locale]');

async function listSegmentFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return listSegmentFiles(fullPath);
      }
      return entry.isFile() && (entry.name === 'page.tsx' || entry.name === 'layout.tsx')
        ? [fullPath]
        : [];
    })
  );

  return files.flat();
}

function isClientComponent(source) {
  const withoutLeadingComments = source
    .replace(/^\/\*[\s\S]*?\*\/\s*/u, '')
    .replace(/^(?:\/\/.*\n\s*)+/u, '')
    .trimStart();

  return /^['"]use client['"];?/u.test(withoutLeadingComments);
}

test('all server [locale] page/layout segments establish next-intl request locale', async () => {
  const segmentFiles = await listSegmentFiles(appLocaleRoot);
  const missing = [];

  for (const file of segmentFiles) {
    const source = await readFile(file, 'utf8');
    if (isClientComponent(source)) {
      continue;
    }

    if (!/\bsetRequestLocale\s*\(/u.test(source)) {
      missing.push(relative(process.cwd(), file).split(sep).join('/'));
    }
  }

  assert.deepEqual(
    missing.sort(),
    [],
    `Server [locale] segments missing setRequestLocale():\n${missing.join('\n')}`
  );
});
