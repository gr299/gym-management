import { q } from '../config/db.js';

/** Records an entry in activity_logs. Never throws: logging must not break the main request. */
export async function logActivity(req, action, entityType, entityId = null, details = null, conn = null) {
  try {
    const text = details == null ? null : (typeof details === 'string' ? details : JSON.stringify(details)).slice(0, 1000);
    const params = [req?.user?.id ?? null, action, entityType, entityId, text, req?.ip ?? null];
    const sql =
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)';
    if (conn) await conn.query(sql, params);
    else await q(sql, params);
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

/** Generates a human-friendly sequential code such as MEM-000123 from an auto-increment id. */
export function makeCode(prefix, id) {
  return `${prefix}-${String(id).padStart(6, '0')}`;
}

/** Express wrapper that sends { data } JSON. */
export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

