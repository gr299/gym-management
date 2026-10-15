import mysql from 'mysql2/promise';
import pg from 'pg';
import { config } from './env.js';

const isPg = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

let poolInstance = null;

if (isPg) {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const { Pool } = pg;
  poolInstance = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  console.log('[Database] Connected via PostgreSQL / Supabase pool');
} else {
  poolInstance = mysql.createPool({
    ...config.db,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',
    dateStrings: ['DATE'],
    decimalNumbers: true,
    multipleStatements: false,
  });
  poolInstance.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  console.log('[Database] Connected via MySQL pool');
}

export const pool = poolInstance;

// Helper to convert MySQL '?' placeholders to Postgres '$1, $2, ...'
function toPgSql(sql) {
  let idx = 1;
  return sql.replace(/\?/g, () => `$${idx++}`);
}

export async function q(sql, params = []) {
  if (isPg) {
    const pgSql = toPgSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows;
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function query(sql, params = []) {
  return q(sql, params);
}

export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

export async function withTransaction(fn) {
  if (isPg) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const connProxy = {
        query: async (sql, params = []) => {
          const pgSql = toPgSql(sql);
          const res = await client.query(pgSql, params);
          return [res.rows, res.fields];
        },
      };
      const result = await fn(connProxy);
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
