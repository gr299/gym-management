import { q, one, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { calculateEndDate } from '../utils/dates.js';
import { gymToday, refreshExpiredSubscriptions } from '../utils/settings.js';
import { logActivity, ok } from '../utils/helpers.js';

// --- Membership Plans ---

export async function listPlans(req, res) {
  const { status } = req.query;
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const plans = await q(`SELECT * FROM membership_plans ${where} ORDER BY price ASC`, params);
  ok(res, plans);
}

export async function createPlan(req, res) {
  const data = validate(req.body, {
    name: { type: 'string', required: true, maxLength: 100 },
    description: { type: 'string', required: false, maxLength: 500 },
    duration_value: { type: 'int', required: true, min: 1 },
    duration_unit: { type: 'enum', values: ['day', 'week', 'month', 'year'], required: true },
    price: { type: 'money', required: true, min: 0 },
    status: { type: 'enum', values: ['active', 'inactive'], required: false, default: 'active' },
  });

  const existing = await one('SELECT id FROM membership_plans WHERE name = ?', [data.name]);
  if (existing) throw ApiError.conflict('A plan with this name already exists');

  const [result] = await q(
    `INSERT INTO membership_plans (name, description, duration_value, duration_unit, price, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.name, data.description || null, data.duration_value, data.duration_unit, data.price, data.status]
  );

  await logActivity(req, 'create', 'membership_plan', result.insertId, `Created plan ${data.name}`);
  const created = await one('SELECT * FROM membership_plans WHERE id = ?', [result.insertId]);
  ok(res, created, 201);
}

export async function updatePlan(req, res) {
  const id = parseId(req.params.id, 'plan id');
  const existing = await one('SELECT * FROM membership_plans WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Membership plan not found');

  const data = validate(
    req.body,
    {
      name: { type: 'string', required: true, maxLength: 100 },
      description: { type: 'string', required: false, maxLength: 500 },
      duration_value: { type: 'int', required: true, min: 1 },
      duration_unit: { type: 'enum', values: ['day', 'week', 'month', 'year'], required: true },
      price: { type: 'money', required: true, min: 0 },
      status: { type: 'enum', values: ['active', 'inactive'], required: false },
    },
    { partial: true }
  );

  if (data.name && data.name !== existing.name) {
    const clash = await one('SELECT id FROM membership_plans WHERE name = ? AND id != ?', [data.name, id]);
    if (clash) throw ApiError.conflict('Another plan with this name already exists');
  }

  await q(
    `UPDATE membership_plans SET
       name = COALESCE(?, name),
       description = ?,
       duration_value = COALESCE(?, duration_value),
       duration_unit = COALESCE(?, duration_unit),
       price = COALESCE(?, price),
       status = COALESCE(?, status)
     WHERE id = ?`,
    [
      data.name,
      data.description !== undefined ? data.description : existing.description,
      data.duration_value,
      data.duration_unit,
      data.price,
      data.status,
      id,
    ]
  );

  await logActivity(req, 'update', 'membership_plan', id, `Updated plan ${data.name || existing.name}`);
  const updated = await one('SELECT * FROM membership_plans WHERE id = ?', [id]);
  ok(res, updated);
}

// --- Subscriptions ---

export async function listSubscriptions(req, res) {
  await refreshExpiredSubscriptions();
  const { member_id, status } = req.query;

  const conditions = [];
  const params = [];

  if (member_id) {
    conditions.push('s.member_id = ?');
    params.push(parseId(member_id));
  }
  if (status) {
    conditions.push('s.status = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await q(
    `SELECT s.*, 
            m.member_code, m.first_name, m.last_name, m.email as member_email,
            p.name as plan_name, p.duration_value, p.duration_unit,
            u.full_name as created_by_name
     FROM subscriptions s
     JOIN members m ON s.member_id = m.id
     JOIN membership_plans p ON s.plan_id = p.id
     LEFT JOIN users u ON s.created_by = u.id
     ${where}
     ORDER BY s.end_date DESC, s.id DESC`,
    params
  );

  ok(res, rows);
}

export async function createSubscription(req, res) {
  const data = validate(req.body, {
    member_id: { type: 'id', required: true },
    plan_id: { type: 'id', required: true },
    start_date: { type: 'date', required: false },
    notes: { type: 'string', required: false, maxLength: 500 },
  });

  const member = await one('SELECT id, status FROM members WHERE id = ?', [data.member_id]);
  if (!member) throw ApiError.notFound('Member not found');
  if (member.status === 'archived') throw ApiError.badRequest('Cannot assign subscription to an archived member');

  const plan = await one('SELECT * FROM membership_plans WHERE id = ?', [data.plan_id]);
  if (!plan) throw ApiError.notFound('Membership plan not found');
  if (plan.status !== 'active') throw ApiError.badRequest('Selected plan is inactive');

  const today = await gymToday();
  const startDate = data.start_date || today;

  // Calculate strict expiration date according to section 6 requirements
  const endDate = calculateEndDate(startDate, plan.duration_value, plan.duration_unit);

  const [result] = await q(
    `INSERT INTO subscriptions (member_id, plan_id, start_date, end_date, price, status, payment_status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, 'active', 'unpaid', ?, ?)`,
    [data.member_id, data.plan_id, startDate, endDate, plan.price, data.notes || null, req.user.id]
  );

  await logActivity(
    req,
    'create',
    'subscription',
    result.insertId,
    `Assigned plan ${plan.name} to member #${data.member_id} until ${endDate}`
  );

  const sub = await one(
    `SELECT s.*, p.name as plan_name 
     FROM subscriptions s 
     JOIN membership_plans p ON s.plan_id = p.id 
     WHERE s.id = ?`,
    [result.insertId]
  );
  ok(res, sub, 201);
}

export async function renewSubscription(req, res) {
  const id = parseId(req.params.id, 'subscription id');
  const prev = await one('SELECT * FROM subscriptions WHERE id = ?', [id]);
  if (!prev) throw ApiError.notFound('Previous subscription not found');

  const plan = await one('SELECT * FROM membership_plans WHERE id = ?', [prev.plan_id]);
  if (!plan) throw ApiError.notFound('Associated membership plan not found');

  const today = await gymToday();
  // If the old subscription has not expired yet, extend from previous end_date + 1 day; otherwise from today
  let startDate = today;
  if (prev.end_date >= today && prev.status === 'active') {
    const nextDay = new Date(prev.end_date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    startDate = nextDay.toISOString().slice(0, 10);
  }

  const endDate = calculateEndDate(startDate, plan.duration_value, plan.duration_unit);

  const [result] = await q(
    `INSERT INTO subscriptions (member_id, plan_id, start_date, end_date, price, status, payment_status, renewed_from_id, created_by)
     VALUES (?, ?, ?, ?, ?, 'active', 'unpaid', ?, ?)`,
    [prev.member_id, prev.plan_id, startDate, endDate, plan.price, prev.id, req.user.id]
  );

  await logActivity(
    req,
    'renew',
    'subscription',
    result.insertId,
    `Renewed subscription #${prev.id} -> #${result.insertId} (${startDate} to ${endDate})`
  );

  const renewed = await one(
    `SELECT s.*, p.name as plan_name 
     FROM subscriptions s 
     JOIN membership_plans p ON s.plan_id = p.id 
     WHERE s.id = ?`,
    [result.insertId]
  );
  ok(res, renewed, 201);
}

export async function cancelSubscription(req, res) {
  const id = parseId(req.params.id, 'subscription id');
  const sub = await one('SELECT * FROM subscriptions WHERE id = ?', [id]);
  if (!sub) throw ApiError.notFound('Subscription not found');

  await q(
    'UPDATE subscriptions SET status = "cancelled", cancelled_at = UTC_TIMESTAMP() WHERE id = ?',
    [id]
  );

  await logActivity(req, 'cancel', 'subscription', id, `Cancelled subscription #${id}`);
  ok(res, { message: 'Subscription cancelled' });
}

