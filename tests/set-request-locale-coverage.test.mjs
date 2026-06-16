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

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:])\/\/.*$/gmu, '$1');
}

function hasSetRequestLocaleCall(source) {
  return /(?:^|[^\w.])setRequestLocale\s*\(/u.test(stripComments(source));
}

function extractFunctionBody(source, functionName) {
  const declaration = new RegExp(`export\\s+async\\s+function\\s+${functionName}\\b`, 'u').exec(source);
  if (!declaration) {
    return null;
  }

  const start = source.indexOf('{', declaration.index);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start + 1, index);
      }
    }
  }

  return null;
}

test('all server [locale] page/layout segments establish next-intl request locale', async () => {
  const segmentFiles = await listSegmentFiles(appLocaleRoot);
  const missing = [];

  for (const file of segmentFiles) {
    const source = await readFile(file, 'utf8');
    if (isClientComponent(source)) {
      continue;
    }

    if (!hasSetRequestLocaleCall(source)) {
      missing.push(relative(process.cwd(), file).split(sep).join('/'));
    }
  }

  assert.deepEqual(
    missing.sort(),
    [],
    `Server [locale] segments missing setRequestLocale():\n${missing.join('\n')}`
  );
});

test('locale-aware generateMetadata handlers establish next-intl request locale', async () => {
  const segmentFiles = await listSegmentFiles(appLocaleRoot);
  const missing = [];

  for (const file of segmentFiles) {
    const source = await readFile(file, 'utf8');
    if (isClientComponent(source)) {
      continue;
    }

    const body = extractFunctionBody(source, 'generateMetadata');
    if (!body || !/\bgetTranslations\s*\(/u.test(stripComments(body))) {
      continue;
    }

    if (!hasSetRequestLocaleCall(body)) {
      missing.push(relative(process.cwd(), file).split(sep).join('/'));
    }
  }

  assert.deepEqual(
    missing.sort(),
    [],
    `Locale-aware generateMetadata handlers missing setRequestLocale():\n${missing.join('\n')}`
  );
});
