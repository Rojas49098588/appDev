import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chipLabel } from '../lib/a11y.ts';

test('an Inventory number chip reads as one phrase', () => {
  assert.equal(chipLabel('Blue', '104', 'assigned', 'repair'), 'Blue 104, assigned, needs repair');
  assert.equal(chipLabel('Red', '7', 'assigned', 'dirty'), 'Red 7, assigned, dirty');
});

test('a chip with no flag still reads sensibly', () => {
  assert.equal(chipLabel('Blue', '103', 'unassigned', null), 'Blue 103, unassigned');
  assert.equal(chipLabel('Blue', '104', 'out_for_repair', null), 'Blue 104, out for repair');
});

const appRoot = path.join(import.meta.dirname, '..');

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

// The opening tag of each <Pressable …>: scan forward tracking {} depth and
// stop at the first ">" outside braces (so "=>" inside props doesn't end it).
function pressableTags(src: string): { line: number; tag: string }[] {
  const tags: { line: number; tag: string }[] = [];
  let at = src.indexOf('<Pressable');
  while (at >= 0) {
    const next = src[at + '<Pressable'.length];
    if (next === ' ' || next === '\n' || next === '\r' || next === '>') {
      let depth = 0;
      let i = at;
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
      }
      tags.push({ line: src.slice(0, at).split('\n').length, tag: src.slice(at, i + 1) });
    }
    at = src.indexOf('<Pressable', at + 1);
  }
  return tags;
}

test('every Pressable tells screen readers what kind of control it is', () => {
  const files = [...tsxFiles(path.join(appRoot, 'screens')), ...tsxFiles(path.join(appRoot, 'components'))];
  const missing: string[] = [];
  for (const file of files) {
    for (const { line, tag } of pressableTags(fs.readFileSync(file, 'utf8'))) {
      if (!tag.includes('accessibilityRole')) missing.push(`${path.relative(appRoot, file)}:${line}`);
    }
  }
  assert.deepEqual(missing, []);
});
