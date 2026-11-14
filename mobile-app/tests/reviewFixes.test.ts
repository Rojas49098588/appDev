// Guards for the final-review findings on the accessibility branch. They read
// source files, because these are layout and screen-reader rules that can't
// run without a phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.join(import.meta.dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(appRoot, rel), 'utf8');

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

// The style block `name: { … }` (or `name: … ,` on one line) inside a makeStyles.
function styleBlock(src: string, name: string): string {
  const at = src.search(new RegExp(`\\n\\s+${name}: `));
  assert.ok(at >= 0, `style ${name} not found`);
  const open = src.indexOf('{', at);
  const lineEnd = src.indexOf('\n', at + 1);
  if (open < 0 || open > lineEnd) return src.slice(at, lineEnd);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  return src.slice(at);
}

test('bottom sheets scroll, so large text never pushes their controls off the screen', () => {
  for (const file of ['components/FlagSheet.tsx', 'components/AddColorSheet.tsx', 'components/AddNumberSheet.tsx', 'components/AddInventorySheet.tsx']) {
    assert.match(read(file), /<ScrollView/, file);
  }
});

test('text boxes are named for what they are, not by an example or a placeholder number', () => {
  const bad: string[] = [];
  for (const file of [...tsxFiles(path.join(appRoot, 'screens')), ...tsxFiles(path.join(appRoot, 'components'))]) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/<TextInput[^>]*?accessibilityLabel="([^"]*)"/g)) {
      const label = m[1];
      if (!/[A-Za-z]/.test(label) || /e\.g\./i.test(label) || /^\d/.test(label)) {
        bad.push(`${path.relative(appRoot, file)}: "${label}"`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('flagged pieces on a member row show the status icon, not just a colored dot', () => {
  const src = read('components/MemberRow.tsx');
  assert.match(src, /StatusIcon/);
  assert.doesNotMatch(src, /styles\.dot/);
});

test('tab labels stay a fixed size (only the phone setting can grow them, capped at 1.3×)', () => {
  for (const file of ['screens/MainTabs.tsx', 'screens/MemberTabs.tsx']) {
    const block = styleBlock(read(file), 'tabLabel');
    assert.doesNotMatch(block, /t\.font\(/, file);
  }
});

test('boxes holding scaling text use minimum sizes, not fixed ones', () => {
  const checks: [string, string][] = [
    ['screens/RecountScreen.tsx', 'stepBtn'],
    ['screens/RecountScreen.tsx', 'batchInput'],
    ['screens/SignUpScreen.tsx', 'heightInput'],
    ['screens/SignUpScreen.tsx', 'weightInput'],
    ['screens/GameEditScreen.tsx', 'groupBtn'],
  ];
  for (const [file, name] of checks) {
    assert.doesNotMatch(styleBlock(read(file), name), /(^|[\s{,])(width|height): /, `${file} ${name}`);
  }
});

test('initials circles keep their letters inside the circle', () => {
  for (const file of ['screens/HomeScreen.tsx', 'screens/member/GameDayScreen.tsx', 'components/MemberRow.tsx', 'screens/ProfileScreen.tsx', 'screens/member/MemberAccountScreen.tsx', 'screens/MemberProfileScreen.tsx', 'screens/ArchivedMemberScreen.tsx']) {
    const src = read(file);
    for (const m of src.matchAll(/<Text style=\{styles\.avatarText\}[^>]*>/g)) {
      assert.match(m[0], /maxFontSizeMultiplier=\{1\}/, file);
    }
  }
});

test('rows let their text shrink or stack so buttons and counts stay on screen', () => {
  assert.match(styleBlock(read('components/OfflineBanner.tsx'), 'text'), /flexShrink: 1/);
  const card = read('components/PieceCard.tsx');
  assert.match(styleBlock(card, 'styleRow'), /t\.isLarge/);
  assert.match(styleBlock(card, 'pieceLeft'), /flexShrink: 1/);
});
