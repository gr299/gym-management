import mysql from 'mysql2/promise';
import pg from 'pg';
import { config } from './env.js';

/**
 * Database adapter supporting two backends with one query API:
 *  - PostgreSQL (Supabase) when DATABASE_URL is set  -> used in production on Vercel
 *  - MySQL / MariaDB (XAMPP) otherwise               -> used for local development
 *
 * Controllers write portable SQL with `?` placeholders. For PostgreSQL the adapter converts
 * placeholders to $1..$n, backtick identifiers to double quotes, LIKE to ILIKE (MySQL's
 * default collation is case-insensitive) and appends `RETURNING id` to INSERTs so callers
 * get the same `{ insertId, affectedRows }` result shape as mysql2.
 */
const SUPABASE_POOLER_URL =
  'postgresql://postgres.huoobomoqezbreioalyo:KgPwVWM56WBi7t6q@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

function resolvePgUrl() {
  const raw = process.env.DATABASE_URL || (process.env.VERCEL ? SUPABASE_POOLER_URL : '');
  if (!raw) return '';
  // If someone configured the IPv6-only direct host db.huoobomoqezbreioalyo.supabase.co:5432 on Vercel, use the IPv4 pooler
  if (raw.includes('huoobomoqezbreioalyo') && raw.includes(':5432')) {
    return SUPABASE_POOLER_URL;
  }
  return raw;
}

const pgConnectionString = resolvePgUrl();
export const isPg = Boolean(pgConnectionString);

// PostgreSQL type parsing: keep DATE as 'YYYY-MM-DD', return NUMERIC/BIGINT as numbers.
pg.types.setTypeParser(1082, (v) => v); // date
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10))); // int8 (COUNT, BIGSERIAL)

function createPool() {
  if (isPg) {
    return new pg.Pool({
      connectionString: pgConnectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  const mysqlPool = mysql.createPool({
    ...config.db,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',
    dateStrings: ['DATE'],
    decimalNumbers: true,
    multipleStatements: false,
  });
  mysqlPool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return mysqlPool;
}

export const pool = createPool();

/** Translates portable/MySQL-flavoured SQL into PostgreSQL. Exported for unit tests. */
export function toPgSql(sql) {
  let idx = 0;
  let out = sql
    .replace(/`([A-Za-z0-9_]+)`/g, '"$1"')
    .replace(/\bUTC_TIMESTAMP\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/DATE_FORMAT\(\s*([^,]+?)\s*,\s*'%Y-%m'\s*\)/gi, "TO_CHAR($1, 'YYYY-MM')")
    .replace(
      /DATE_SUB\(\s*CURRENT_TIMESTAMP\s*,\s*INTERVAL\s+(\d+)\s+(DAY|MONTH|YEAR)\s*\)/gi,
      "(CURRENT_TIMESTAMP - INTERVAL '$1 $2')"
    )
    .replace(/\bLIKE\b/g, 'ILIKE')
    .replace(/\?/g, () => `$${++idx}`);
  if (/^\s*INSERT\s/i.test(out) && !/\bRETURNING\b/i.test(out)) out = `${out.trim()} RETURNING id`;
  return out;
}

function pgResult(sql, res) {
  if (/^\s*INSERT\s/i.test(sql)) return { insertId: res.rows[0]?.id ?? null, affectedRows: res.rowCount };
  if (/^\s*(UPDATE|DELETE)\s/i.test(sql)) return { affectedRows: res.rowCount };
  return res.rows;
}

/** Runs a query. SELECT returns rows; INSERT/UPDATE/DELETE return { insertId, affectedRows }. */
export async function q(sql, params = []) {
  if (isPg) {
    const res = await pool.query(toPgSql(sql), params);
    return pgResult(sql, res);
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

export const query = q;

export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

/**
 * Runs fn(conn) inside a transaction. conn.query(sql, params) resolves to [result, fields]
 * on both backends, mirroring mysql2.
 */
export async function withTransaction(fn) {
  if (isPg) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const conn = {
        query: async (sql, params = []) => {
          const res = await client.query(toPgSql(sql), params);
          return [pgResult(sql, res), res.fields];
        },
      };
      const result = await fn(conn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
