import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres.huoobomoqezbreioalyo:KgPwVWM56WBi7t6q@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

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

  // Ensure supabase_seed.sql has a real valid bcrypt hash for Admin123!
  const demoPassword = 'Admin123!';
  const validHash = bcrypt.hashSync(demoPassword, 10);

  const seedPath = path.join(__dirname, '..', 'database', 'supabase_seed.sql');
  let seed = fs.readFileSync(seedPath, 'utf8');
  seed = seed.replace(/\$2[ab]\$10\$[A-Za-z0-9./]{53}/g, validHash);
  fs.writeFileSync(seedPath, seed, 'utf8');

  console.log('Applying demo seed data to Supabase...');
  await pool.query(seed);
  console.log('✓ Seed data applied successfully.');

  // Verify every demo user can authenticate with Admin123!
  const usersRes = await pool.query('SELECT id, full_name, email, role, password_hash, is_active FROM users ORDER BY id;');
  for (const u of usersRes.rows) {
    const ok = bcrypt.compareSync(demoPassword, u.password_hash);
    console.log(`✓ Demo user [${u.role}] ${u.email} -> password_ok=${ok}, active=${u.is_active}`);
    if (!ok) {
      throw new Error(`Password hash verification failed for ${u.email}`);
    }
  }

  await pool.end();
  console.log('All migrations and demo user password updates completed successfully on Supabase!');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  pool.end();
  process.exit(1);
});
