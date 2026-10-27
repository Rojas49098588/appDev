// Creates (or keeps) TEST-project accounts for the member rows of a roster CSV, so the
// import can be tried on a phone. Every account gets the same easy-to-type password
// (TEST_PASSWORD below) and is listed in supabase/.env.test-members.local (git-ignored).
// Usage (from mobile-app/):
//   npm run test:members -- path/to/roster.csv
// Safety: only ever talks to the project in supabase/.env.test.local, and refuses to run
// if that URL equals the live URL in supabase/.env.local (read only to compare).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseCsv } from '../../lib/import/csv.ts';
import { classifyRows, findColumns } from '../../lib/import/rows.ts';

// TEST project only, so a shared simple password is fine and easy to type on a phone.
const TEST_PASSWORD = 'mustangtest2026';
const LOGINS_FILE = 'supabase/.env.test-members.local';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};
// Host of a URL, lowercased; null when it can't be parsed.
const hostOf = (u) => {
  try {
    return new URL(String(u).trim()).host.toLowerCase();
  } catch {
    return null;
  }
};

const csvPath = process.argv[2];
if (!csvPath) fail('Usage: npm run test:members -- path/to/roster.csv');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inviteCode = process.env.INVITE_CODE;
if (!url || !serviceKey || !inviteCode) {
  fail('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or INVITE_CODE. Run via npm run test:members (loads supabase/.env.test.local).');
}

// Fail closed: if the live URL can't be read and compared, refuse.
const testHost = hostOf(url);
if (testHost === null) fail('REFUSING TO RUN: SUPABASE_URL in supabase/.env.test.local is not a valid URL.');

const liveEnvPath = new URL('../.env.local', import.meta.url);
const cantCompare = "Can't read the live SUPABASE_URL from supabase/.env.local to confirm this isn't live; refusing.";
let liveText;
try {
  liveText = readFileSync(liveEnvPath, 'utf8');
} catch {
  fail(cantCompare);
}
const liveRaw = liveText.match(/^\s*(?:export\s+)?SUPABASE_URL\s*=\s*["']?([^"'\r\n#]*)/m)?.[1];
if (!liveRaw || !liveRaw.trim()) fail(cantCompare);
const liveHost = hostOf(liveRaw);
if (liveHost === null) fail("REFUSING TO RUN: the live SUPABASE_URL in supabase/.env.local isn't a valid URL, so it can't be compared.");
if (liveHost === testHost) {
  fail('REFUSING TO RUN: SUPABASE_URL in supabase/.env.test.local is the LIVE project URL. This script only works against the TEST project.');
}

const cells = parseCsv(readFileSync(csvPath, 'utf8'));
const cols = findColumns(cells[0] ?? []);
if ('missing' in cols) fail(`CSV is missing columns: ${cols.missing.join(', ')}`);

// Member names are "Last First" (first token is the last name).
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const people = new Map();
for (const row of classifyRows(cells, cols)) {
  if (row.kind !== 'member') continue;
  const [last, ...rest] = row.name.split(/\s+/);
  const first = rest.join(' ');
  if (!first) {
    console.warn(`Line ${row.line}: skipped "${row.name}" (need "Last First")`);
    continue;
  }
  const email = `test-${slug(first)}-${slug(last)}@mustangcloset.test`;
  if (!people.has(email)) people.set(email, { first, last, email });
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const existing = new Set();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) fail(`Could not list users: ${error.message}`);
  for (const u of data.users) existing.add((u.email ?? '').toLowerCase());
  if (data.users.length < 1000) break;
}

let created = 0;
let kept = 0;
for (const p of people.values()) {
  if (existing.has(p.email)) {
    kept++;
    console.log(`kept     ${p.email}  (${p.first} ${p.last}; password unchanged)`);
    continue;
  }
  const password = TEST_PASSWORD;
  const { error } = await admin.auth.admin.createUser({
    email: p.email,
    password,
    email_confirm: true,
    user_metadata: { invite_code: inviteCode, first_name: p.first, last_name: p.last, instrument: '' },
  });
  if (error) fail(`Could not create ${p.email}: ${error.message}`);
  created++;
  console.log(`created  ${p.email}  (${p.first} ${p.last})`);
}

// Keep the logins file listing every TEST account this script knows about.
const header = `# TEST project only. Every account below uses the password: ${TEST_PASSWORD}`;
const listed = existsSync(LOGINS_FILE)
  ? readFileSync(LOGINS_FILE, 'utf8').split(/\r?\n/).filter((l) => l.includes('@'))
  : [];
const emails = [...new Set([...listed, ...people.keys()])].sort();
writeFileSync(LOGINS_FILE, [header, '', ...emails].join('\n') + '\n');
console.log(`Done: ${created} created, ${kept} kept. Password for new accounts: ${TEST_PASSWORD} (listed in ${LOGINS_FILE}).`);
