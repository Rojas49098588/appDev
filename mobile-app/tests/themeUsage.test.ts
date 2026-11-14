import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.join(import.meta.dirname, '..');

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

// Static colors can't follow High contrast; screens must use useTheme()/useThemedStyles().
test('no screen or component imports constants/colors', () => {
  const files = [
    ...tsxFiles(path.join(appRoot, 'screens')),
    ...tsxFiles(path.join(appRoot, 'components')),
    path.join(appRoot, 'App.tsx'),
  ];
  const offenders = files
    .filter((f) => fs.readFileSync(f, 'utf8').includes('constants/colors'))
    .map((f) => path.relative(appRoot, f));
  assert.deepEqual(offenders, []);
});
