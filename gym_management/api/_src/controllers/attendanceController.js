import { q, one } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { getPagination, buildWhere, likeParam, paged } from '../utils/query.js';
import { logActivity, ok } from '../utils/helpers.js';
import { gymToday, getSettings, refreshExpiredSubscriptions } from '../utils/settings.js';
import { localDateRangeUtc, dateInTimeZone, addDays } from '../utils/dates.js';

export async function checkIn(req, res) {
  const data = validate(req.body, {
    member_id: { type: 'id', required: true },
    notes: { type: 'string', required: false, maxLength: 255 },
  });

  const member = await one('SELECT id, member_code, first_name, last_name, status FROM members WHERE id = ?', [
    data.member_id,
  ]);
  if (!member) throw ApiError.notFound('Member not found');
  if (member.status === 'archived') throw ApiError.badRequest('Archived member cannot check in');

  // Prevent duplicate active check-ins (Requirement 7)
  const activeCheckin = await one(
    'SELECT id, check_in FROM attendance WHERE member_id = ? AND check_out IS NULL',
    [data.member_id]
  );
  if (activeCheckin) {
    throw ApiError.conflict('Member is already checked in. Please check out first.');
  }

  // Validate membership eligibility (Requirement 7)
  await refreshExpiredSubscriptions();
  const settings = await getSettings();
  const today = await gymToday();
  const minEndDate = addDays(today, -(settings.grace_period_days || 0));

  const sub = await one(
    `SELECT s.*, p.name as plan_name 
     FROM subscriptions s
     JOIN membership_plans p ON s.plan_id = p.id
     WHERE s.member_id = ? 
       AND s.status = 'active'
       AND s.start_date <= ?
       AND s.end_date >= ?
     ORDER BY s.end_date DESC LIMIT 1`,
    [data.member_id, today, minEndDate]
  );

  let warning = null;
  if (!sub) {
    warning = 'No active membership plan found for this member.';
  } else if (settings.checkin_requires_payment && sub.payment_status === 'unpaid') {
    warning = `Membership (${sub.plan_name}) is currently UNPAID.`;
  }

  // Insert check-in record (UTC timestamp)
  const result = await q(
    `INSERT INTO attendance (member_id, check_in, recorded_by, notes)
     VALUES (?, CURRENT_TIMESTAMP, ?, ?)`,
    [data.member_id, req.user.id, data.notes || null]
  );

  await logActivity(
    req,
    'check_in',
    'attendance',
    result.insertId,
    `Checked in member ${member.member_code} (${member.first_name} ${member.last_name})`
  );

  const record = await one(
    `SELECT a.*, m.member_code, m.first_name, m.last_name 
     FROM attendance a 
     JOIN members m ON a.member_id = m.id 
     WHERE a.id = ?`,
    [result.insertId]
  );

  ok(res, { attendance: record, warning }, 201);
}

export async function checkOut(req, res) {
  const data = validate(req.body, {
    attendance_id: { type: 'id', required: false },
    member_id: { type: 'id', required: false },
  });

  if (!data.attendance_id && !data.member_id) {
    throw ApiError.badRequest('Either attendance_id or member_id must be provided');
  }

  let active;
  if (data.attendance_id) {
    active = await one('SELECT * FROM attendance WHERE id = ? AND check_out IS NULL', [data.attendance_id]);
  } else {
    active = await one('SELECT * FROM attendance WHERE member_id = ? AND check_out IS NULL', [data.member_id]);
  }

  if (!active) throw ApiError.notFound('No active check-in found to check out');

  await q('UPDATE attendance SET check_out = CURRENT_TIMESTAMP WHERE id = ?', [active.id]);

  await logActivity(req, 'check_out', 'attendance', active.id, `Checked out attendance #${active.id}`);

  const updated = await one(
    `SELECT a.*, m.member_code, m.first_name, m.last_name 
     FROM attendance a 
     JOIN members m ON a.member_id = m.id 
     WHERE a.id = ?`,
    [active.id]
  );
  ok(res, updated);
}

export async function listAttendance(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { search, date, from_date, to_date, active_only, member_id } = req.query;

  const settings = await getSettings();
  const conditions = [];

  if (member_id) {
    conditions.push(['a.member_id = ?', parseId(member_id)]);
  }

  if (active_only === 'true' || active_only === '1') {
    conditions.push(['a.check_out IS NULL']);
  }

  if (date) {
    const [startUtc, endUtc] = localDateRangeUtc(date, date, settings.timezone);
    conditions.push(['a.check_in >= ? AND a.check_in < ?', startUtc, endUtc]);
  } else if (from_date && to_date) {
    const [startUtc, endUtc] = localDateRangeUtc(from_date, to_date, settings.timezone);
    conditions.push(['a.check_in >= ? AND a.check_in < ?', startUtc, endUtc]);
  }

  if (search) {
    conditions.push([
      '(m.member_code LIKE ? OR m.first_name LIKE ? OR m.last_name LIKE ?)',
      likeParam(search),
      likeParam(search),
      likeParam(search),
    ]);
  }

  const { where, params } = buildWhere(conditions);

  const countRow = await one(
    `SELECT COUNT(*) as total 
     FROM attendance a 
     JOIN members m ON a.member_id = m.id 
     ${where}`,
    params
  );
  const total = countRow ? Number(countRow.total) : 0;

  const rows = await q(
    `SELECT a.*, 
            m.member_code, m.first_name, m.last_name, m.email as member_email,
            u.full_name as recorded_by_name
     FROM attendance a
     JOIN members m ON a.member_id = m.id
     LEFT JOIN users u ON a.recorded_by = u.id
     ${where}
     ORDER BY a.check_in DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  ok(res, paged(rows, total, { page, limit }));
}

export async function getAttendanceStats(req, res) {
  const settings = await getSettings();
  const today = await gymToday();
  const [todayStart, todayEnd] = localDateRangeUtc(today, today, settings.timezone);

  const [todayStats, currentlyInside] = await Promise.all([
    one(
      'SELECT COUNT(*) as total_today FROM attendance WHERE check_in >= ? AND check_in < ?',
      [todayStart, todayEnd]
    ),
    one('SELECT COUNT(*) as total_inside FROM attendance WHERE check_out IS NULL'),
  ]);

  ok(res, {
    total_today: todayStats ? Number(todayStats.total_today) : 0,
    currently_inside: currentlyInside ? Number(currentlyInside.total_inside) : 0,
    date: today,
    timezone: settings.timezone,
  });
}

