import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const connectionString = 'postgresql://postgres.huoobomoqezbreioalyo:KgPwVWM56WBi7t6q@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Connecting to Supabase...');
  const schemaPath = path.join(__dirname, '..', 'database', 'supabase_schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  console.log('Applying database schema to Supabase...');
  await pool.query(schema);
  console.log('✓ Schema applied successfully.');

  const seedPath = path.join(__dirname, '..', 'database', 'supabase_seed.sql');
  const seed = fs.readFileSync(seedPath, 'utf8');
  console.log('Applying demo seed data to Supabase...');
  await pool.query(seed);
  console.log('✓ Seed data applied successfully.');

  const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('✓ Supabase Tables created:', tablesRes.rows.map(r => r.table_name));

  const usersRes = await pool.query('SELECT full_name, email, role FROM users;');
  console.log('✓ Seeded Users:', usersRes.rows);

  await pool.end();
  console.log('All migrations completed successfully on Supabase!');
}

run().catch(err => {
  console.error('Migration failed:', err);
  pool.end();
  process.exit(1);
});
