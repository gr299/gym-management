import mysql from 'mysql2/promise';
import { config } from './env.js';

// All DATETIME values are stored in UTC. The gym's local timezone (gym_settings.timezone)
// is applied only when presenting data or computing "today" for business rules.
export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
  multipleStatements: false,
});

pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Same as query() but uses client-side escaping; needed for LIMIT/IN lists with dynamic values. */
export async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

/** Runs fn(conn) inside a transaction, committing on success and rolling back on error. */
export async function withTransaction(fn) {
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

