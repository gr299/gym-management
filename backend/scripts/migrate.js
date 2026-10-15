// Creates the database (if missing) and applies database/schema.sql.
// Safe to run repeatedly: every statement uses CREATE TABLE IF NOT EXISTS / INSERT IGNORE.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function splitSqlStatements(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function migrate({ quiet = false } = {}) {
  const { database, ...conn } = config.db;
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_NAME may only contain letters, digits and underscores');

  const connection = await mysql.createConnection({ ...conn, timezone: 'Z' });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${database}\``);
    await connection.query("SET time_zone = '+00:00'");
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    const statements = splitSqlStatements(sql);
    for (const statement of statements) {
      await connection.query(statement);
    }
    if (!quiet) console.log(`Migration complete: ${statements.length} statements applied to "${database}".`);
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

