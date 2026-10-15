import crypto from 'node:crypto';
import { q, one, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { getPagination, getSort, buildWhere, likeParam, paged } from '../utils/query.js';
import { logActivity, ok } from '../utils/helpers.js';
import { getSettings } from '../utils/settings.js';

export async function listPayments(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { search, method, status, member_id, from_date, to_date } = req.query;

  const conditions = [];

  if (req.user.role === 'member') {
    conditions.push(['p.member_id = ?', req.user.member_id]);
  } else if (member_id) {
    conditions.push(['p.member_id = ?', parseId(member_id)]);
  }

  if (method) conditions.push(['p.method = ?', method]);
  if (status) conditions.push(['p.status = ?', status]);
  if (from_date) conditions.push(['p.payment_date >= ?', `${from_date} 00:00:00`]);
  if (to_date) conditions.push(['p.payment_date <= ?', `${to_date} 23:59:59`]);

  if (search) {
    conditions.push([
      '(p.receipt_no LIKE ? OR p.reference LIKE ? OR m.member_code LIKE ? OR m.first_name LIKE ? OR m.last_name LIKE ?)',
      likeParam(search),
      likeParam(search),
      likeParam(search),
      likeParam(search),
      likeParam(search),
    ]);
  }

  const { where, params } = buildWhere(conditions);

  const countRow = await one(
    `SELECT COUNT(*) as total 
     FROM payments p
     JOIN members m ON p.member_id = m.id
     ${where}`,
    params
  );
  const total = countRow ? Number(countRow.total) : 0;

  const sortSql = getSort(
    req.query,
    {
      payment_date: 'p.payment_date',
      amount: 'p.amount',
      receipt_no: 'p.receipt_no',
    },
    'payment_date'
  );

  const rows = await q(
    `SELECT p.*,
            m.member_code, m.first_name, m.last_name, m.email as member_email,
            s.plan_id, mp.name as plan_name,
            u.full_name as recorded_by_name
     FROM payments p
     JOIN members m ON p.member_id = m.id
     LEFT JOIN subscriptions s ON p.subscription_id = s.id
     LEFT JOIN membership_plans mp ON s.plan_id = mp.id
     LEFT JOIN users u ON p.recorded_by = u.id
     ${where}
     ORDER BY ${sortSql}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  ok(res, paged(rows, total, { page, limit }));
}

export async function createPayment(req, res) {
  const data = validate(req.body, {
    member_id: { type: 'id', required: true },
    subscription_id: { type: 'id', required: false },
    amount: { type: 'money', required: true, min: 0.01 },
    method: { type: 'enum', values: ['cash', 'bank_transfer', 'e_wallet', 'card'], required: true },
    reference: { type: 'string', required: false, maxLength: 100 },
    description: { type: 'string', required: false, maxLength: 255 },
    status: { type: 'enum', values: ['pending', 'completed'], required: false, default: 'completed' },
    idempotency_key: { type: 'string', required: false, maxLength: 64 },
  });

  const member = await one('SELECT id, member_code, first_name, last_name FROM members WHERE id = ?', [
    data.member_id,
  ]);
  if (!member) throw ApiError.notFound('Member not found');

  // Check subscription if specified
  if (data.subscription_id) {
    const sub = await one('SELECT * FROM subscriptions WHERE id = ? AND member_id = ?', [
      data.subscription_id,
      data.member_id,
    ]);
    if (!sub) throw ApiError.badRequest('Subscription not found or does not belong to this member');
  }

  // Idempotency check to prevent duplicate clicks (Requirement 8)
  if (data.idempotency_key) {
    const existing = await one('SELECT * FROM payments WHERE idempotency_key = ?', [data.idempotency_key]);
    if (existing) {
      return ok(res, existing);
    }
  }

  // Use database transaction for atomic multi-record updates (Requirement 8 & 15)
  const result = await withTransaction(async (conn) => {
    // Generate unique receipt number: REC-YYYY-XXXXXX
    const year = new Date().getUTCFullYear();
    const rand = crypto.randomInt(100000, 999999);
    const receiptNo = `REC-${year}-${rand}`;

    const [ins] = await conn.query(
      `INSERT INTO payments (receipt_no, member_id, subscription_id, amount, payment_date, method, reference, status, description, idempotency_key, recorded_by)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?)`,
      [
        receiptNo,
        data.member_id,
        data.subscription_id || null,
        data.amount,
        data.method,
        data.reference || null,
        data.status,
        data.description || null,
        data.idempotency_key || null,
        req.user.id,
      ]
    );

    const paymentId = ins.insertId;

    // Audit trail
    await conn.query(
      `INSERT INTO payment_audit (payment_id, action, new_status, new_amount, reason, user_id)
       VALUES (?, 'created', ?, ?, 'Initial payment record', ?)`,
      [paymentId, data.status, data.amount, req.user.id]
    );

    // If subscription is linked and payment is completed, update subscription payment_status
    if (data.subscription_id && data.status === 'completed') {
      const [paymentsForSub] = await conn.query(
        'SELECT SUM(amount) as total_paid FROM payments WHERE subscription_id = ? AND status = "completed"',
        [data.subscription_id]
      );
      const totalPaid = Number(paymentsForSub[0]?.total_paid || 0);

      const [subRows] = await conn.query('SELECT price FROM subscriptions WHERE id = ?', [data.subscription_id]);
      const subPrice = Number(subRows[0]?.price || 0);

      const newPayStatus = totalPaid >= subPrice ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
      await conn.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?', [
        newPayStatus,
        data.subscription_id,
      ]);
    }

    return { paymentId, receiptNo };
  });

  await logActivity(req, 'create', 'payment', result.paymentId, `Recorded payment ${result.receiptNo}`);
  const created = await one('SELECT * FROM payments WHERE id = ?', [result.paymentId]);
  ok(res, created, 201);
}

export async function refundPayment(req, res) {
  const id = parseId(req.params.id, 'payment id');
  const { reason } = validate(req.body, {
    reason: { type: 'string', required: true, maxLength: 255 },
  });

  const payment = await one('SELECT * FROM payments WHERE id = ?', [id]);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'refunded') throw ApiError.badRequest('Payment has already been refunded');

  await withTransaction(async (conn) => {
    await conn.query(
      'UPDATE payments SET status = "refunded", updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?',
      [req.user.id, id]
    );

    // Audit trail
    await conn.query(
      `INSERT INTO payment_audit (payment_id, action, old_status, new_status, reason, user_id)
       VALUES (?, 'refunded', ?, 'refunded', ?, ?)`,
      [id, payment.status, reason, req.user.id]
    );

    // If subscription linked, recalculate subscription payment status
    if (payment.subscription_id) {
      const [paymentsForSub] = await conn.query(
        'SELECT SUM(amount) as total_paid FROM payments WHERE subscription_id = ? AND status = "completed"',
        [payment.subscription_id]
      );
      const totalPaid = Number(paymentsForSub[0]?.total_paid || 0);

      const [subRows] = await conn.query('SELECT price FROM subscriptions WHERE id = ?', [payment.subscription_id]);
      const subPrice = Number(subRows[0]?.price || 0);

      const newPayStatus = totalPaid >= subPrice ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
      await conn.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?', [
        newPayStatus,
        payment.subscription_id,
      ]);
    }
  });

  await logActivity(req, 'refund', 'payment', id, `Refunded payment ${payment.receipt_no}: ${reason}`);
  const updated = await one('SELECT * FROM payments WHERE id = ?', [id]);
  ok(res, updated);
}

export async function getReceipt(req, res) {
  const id = parseId(req.params.id, 'payment id');
  const payment = await one(
    `SELECT p.*,
            m.member_code, m.first_name, m.last_name, m.email as member_email, m.phone as member_phone,
            s.plan_id, mp.name as plan_name,
            u.full_name as recorded_by_name
     FROM payments p
     JOIN members m ON p.member_id = m.id
     LEFT JOIN subscriptions s ON p.subscription_id = s.id
     LEFT JOIN membership_plans mp ON s.plan_id = mp.id
     LEFT JOIN users u ON p.recorded_by = u.id
     WHERE p.id = ?`,
    [id]
  );
  if (!payment) throw ApiError.notFound('Payment receipt not found');

  if (req.user.role === 'member' && req.user.member_id !== payment.member_id) {
    throw ApiError.forbidden();
  }

  const settings = await getSettings();

  ok(res, {
    gym: {
      name: settings.gym_name,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      currency: settings.currency,
      receipt_footer: settings.receipt_footer,
    },
    payment,
  });
}

