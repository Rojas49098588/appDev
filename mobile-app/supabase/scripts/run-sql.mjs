// Applies SQL files to the Supabase database, or checks the connection with --check.
// Usage: node --env-file=supabase/.env.local supabase/scripts/run-sql.mjs <file.sql> [...]
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL is missing. Copy supabase/.env.example to supabase/.env.local and fill it in.');
  process.exit(1);
}

const args = process.argv.slice(2);
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  if (args[0] === '--check') {
    const { rows } = await client.query('select current_database() as db');
    console.log(`Connected to database "${rows[0].db}".`);
  } else {
    for (const file of args) {
      await client.query(await readFile(file, 'utf8'));
      console.log(`Applied ${file}`);
    }
  }
} finally {
  await client.end();
}
