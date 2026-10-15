import { one, q } from '../config/db.js';
import { dateInTimeZone } from './dates.js';

let cache = null;
let cachedAt = 0;
const TTL_MS = 30_000;

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;
  const row = await one('SELECT * FROM gym_settings WHERE id = 1');
  cache = row
    ? { ...row, checkin_requires_payment: Boolean(row.checkin_requires_payment) }
    : { gym_name: 'My Gym', currency: 'PHP', timezone: 'Asia/Manila', grace_period_days: 0, checkin_requires_payment: true, expiring_soon_days: 7, default_session_minutes: 60 };
  cachedAt = Date.now();
  return cache;
}

export function clearSettingsCache() {
  cache = null;
}

/** Today's calendar date in the gym's configured timezone. */
export async function gymToday() {
  const s = await getSettings();
  return dateInTimeZone(new Date(), s.timezone);
}

/**
 * Marks active subscriptions whose end date has passed as expired. Called before reads that
 * depend on subscription state so the stored status stays accurate without a cron job.
 */
export async function refreshExpiredSubscriptions(conn) {
  const today = await gymToday();
  const sql = "UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND end_date < ?";
  if (conn) await conn.query(sql, [today]);
  else await q(sql, [today]);
  return today;
}

