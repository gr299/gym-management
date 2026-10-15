import { q, one, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { getPagination, getSort, buildWhere, likeParam, paged } from '../utils/query.js';
import { logActivity, ok, makeCode } from '../utils/helpers.js';
import { gymToday, refreshExpiredSubscriptions } from '../utils/settings.js';

export async function listMembers(req, res) {
  await refreshExpiredSubscriptions();
  const { page, limit, offset } = getPagination(req.query);
  const { search, status, trainer_id } = req.query;

  const conditions = [
    status ? ['m.status = ?', status] : ['m.status != ?', 'archived'],
    trainer_id ? ['m.trainer_id = ?', Number(trainer_id)] : null,
    search
      ? [
          '(m.member_code LIKE ? OR m.first_name LIKE ? OR m.last_name LIKE ? OR m.email LIKE ? OR m.phone LIKE ?)',
          likeParam(search),
          likeParam(search),
          likeParam(search),
          likeParam(search),
          likeParam(search),
        ]
      : null,
  ];

  // If role is trainer, restrict to assigned members
  if (req.user.role === 'trainer') {
    conditions.push(['m.trainer_id = ?', req.user.trainer_id]);
  }

  const { where, params } = buildWhere(conditions);

  const countRow = await one(
    `SELECT COUNT(*) as total FROM members m ${where}`,
    params
  );
  const total = countRow ? Number(countRow.total) : 0;

  const sortSql = getSort(
    req.query,
    {
      name: 'm.last_name',
      registration_date: 'm.registration_date',
      member_code: 'm.member_code',
      status: 'm.status',
    },
    'registration_date'
  );

  const rows = await q(
    `SELECT m.*, 
            t.full_name AS trainer_name,
            sub.plan_name AS current_plan_name,
            sub.end_date AS membership_end_date,
            sub.status AS subscription_status
     FROM members m
     LEFT JOIN trainers t ON m.trainer_id = t.id
     LEFT JOIN (
       SELECT s.member_id, p.name AS plan_name, s.end_date, s.status
       FROM subscriptions s
       JOIN membership_plans p ON s.plan_id = p.id
       WHERE s.id = (
         SELECT id FROM subscriptions 
         WHERE member_id = s.member_id 
         ORDER BY end_date DESC, id DESC LIMIT 1
       )
     ) sub ON sub.member_id = m.id
     ${where}
     ORDER BY ${sortSql}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  ok(res, paged(rows, total, { page, limit }));
}

export async function getMember(req, res) {
  const id = parseId(req.params.id, 'member id');

  if (req.user.role === 'member' && req.user.member_id !== id) {
    throw ApiError.forbidden('You can only view your own profile');
  }

  const member = await one(
    `SELECT m.*, t.full_name as trainer_name, t.phone as trainer_phone, t.email as trainer_email
     FROM members m
     LEFT JOIN trainers t ON m.trainer_id = t.id
     WHERE m.id = ?`,
    [id]
  );
  if (!member) throw ApiError.notFound('Member not found');

  if (req.user.role === 'trainer' && member.trainer_id !== req.user.trainer_id) {
    throw ApiError.forbidden('You can only view members assigned to you');
  }

  // Active subscription
  const currentSubscription = await one(
    `SELECT s.*, p.name as plan_name, p.duration_value, p.duration_unit
     FROM subscriptions s
     JOIN membership_plans p ON s.plan_id = p.id
     WHERE s.member_id = ?
     ORDER BY s.end_date DESC, s.id DESC LIMIT 1`,
    [id]
  );

  ok(res, { ...member, currentSubscription });
}

export async function createMember(req, res) {
  const data = validate(req.body, {
    first_name: { type: 'string', required: true, maxLength: 80 },
    last_name: { type: 'string', required: true, maxLength: 80 },
    email: { type: 'email', required: true },
    phone: { type: 'phone', required: false },
    address: { type: 'string', required: false, maxLength: 255 },
    date_of_birth: { type: 'date', required: false },
    gender: { type: 'enum', values: ['male', 'female', 'other', 'prefer_not_to_say'], required: false },
    registration_date: { type: 'date', required: false, default: await gymToday() },
    emergency_contact_name: { type: 'string', required: false, maxLength: 120 },
    emergency_contact_phone: { type: 'phone', required: false },
    trainer_id: { type: 'id', required: false },
    status: { type: 'enum', values: ['active', 'inactive'], required: false, default: 'active' },
    notes: { type: 'string', required: false },
  });

  const existing = await one('SELECT id FROM members WHERE email = ?', [data.email]);
  if (existing) throw ApiError.conflict('A member with this email address already exists');

  if (data.trainer_id) {
    const trainer = await one('SELECT id FROM trainers WHERE id = ?', [data.trainer_id]);
    if (!trainer) throw ApiError.badRequest('Selected trainer does not exist');
  }

  const result = await withTransaction(async (conn) => {
    const tempCode = `MEM-TMP-${Date.now()}`;
    const [ins] = await conn.query(
      `INSERT INTO members (member_code, first_name, last_name, email, phone, address, date_of_birth, gender,
                            registration_date, emergency_contact_name, emergency_contact_phone, trainer_id, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tempCode,
        data.first_name,
        data.last_name,
        data.email,
        data.phone || null,
        data.address || null,
        data.date_of_birth || null,
        data.gender || null,
        data.registration_date,
        data.emergency_contact_name || null,
        data.emergency_contact_phone || null,
        data.trainer_id || null,
        data.status,
        data.notes || null,
        req.user.id,
      ]
    );

    const memberId = ins.insertId;
    const realCode = makeCode('MEM', memberId);
    await conn.query('UPDATE members SET member_code = ? WHERE id = ?', [realCode, memberId]);
    return { memberId, memberCode: realCode };
  });

  await logActivity(req, 'create', 'member', result.memberId, `Created member ${result.memberCode}`);
  const created = await one('SELECT * FROM members WHERE id = ?', [result.memberId]);
  ok(res, created, 201);
}

export async function updateMember(req, res) {
  const id = parseId(req.params.id, 'member id');
  const existing = await one('SELECT * FROM members WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Member not found');

  const data = validate(
    req.body,
    {
      first_name: { type: 'string', required: true, maxLength: 80 },
      last_name: { type: 'string', required: true, maxLength: 80 },
      email: { type: 'email', required: true },
      phone: { type: 'phone', required: false },
      address: { type: 'string', required: false, maxLength: 255 },
      date_of_birth: { type: 'date', required: false },
      gender: { type: 'enum', values: ['male', 'female', 'other', 'prefer_not_to_say'], required: false },
      emergency_contact_name: { type: 'string', required: false, maxLength: 120 },
      emergency_contact_phone: { type: 'phone', required: false },
      trainer_id: { type: 'id', required: false },
      status: { type: 'enum', values: ['active', 'inactive'], required: false },
      notes: { type: 'string', required: false },
    },
    { partial: true }
  );

  if (data.email && data.email !== existing.email) {
    const clash = await one('SELECT id FROM members WHERE email = ? AND id != ?', [data.email, id]);
    if (clash) throw ApiError.conflict('Another member already has this email address');
  }

  if (data.trainer_id) {
    const trainer = await one('SELECT id FROM trainers WHERE id = ?', [data.trainer_id]);
    if (!trainer) throw ApiError.badRequest('Selected trainer does not exist');
  }

  await q(
    `UPDATE members SET
       first_name = COALESCE(?, first_name),
       last_name = COALESCE(?, last_name),
       email = COALESCE(?, email),
       phone = ?,
       address = ?,
       date_of_birth = ?,
       gender = ?,
       emergency_contact_name = ?,
       emergency_contact_phone = ?,
       trainer_id = ?,
       status = COALESCE(?, status),
       notes = ?
     WHERE id = ?`,
    [
      data.first_name,
      data.last_name,
      data.email,
      data.phone !== undefined ? data.phone : existing.phone,
      data.address !== undefined ? data.address : existing.address,
      data.date_of_birth !== undefined ? data.date_of_birth : existing.date_of_birth,
      data.gender !== undefined ? data.gender : existing.gender,
      data.emergency_contact_name !== undefined ? data.emergency_contact_name : existing.emergency_contact_name,
      data.emergency_contact_phone !== undefined ? data.emergency_contact_phone : existing.emergency_contact_phone,
      data.trainer_id !== undefined ? data.trainer_id : existing.trainer_id,
      data.status,
      data.notes !== undefined ? data.notes : existing.notes,
      id,
    ]
  );

  await logActivity(req, 'update', 'member', id, `Updated profile for member ${existing.member_code}`);
  const updated = await one('SELECT * FROM members WHERE id = ?', [id]);
  ok(res, updated);
}

export async function deleteMember(req, res) {
  const id = parseId(req.params.id, 'member id');
  const existing = await one('SELECT * FROM members WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Member not found');

  // Requirements 5 & 15: Safe deletion/archival to preserve historical payment and attendance records
  await q('UPDATE members SET status = "archived", archived_at = UTC_TIMESTAMP() WHERE id = ?', [id]);

  await logActivity(req, 'archive', 'member', id, `Archived member ${existing.member_code}`);
  ok(res, { message: `Member ${existing.member_code} archived successfully` });
}

export async function getMemberHistory(req, res) {
  const id = parseId(req.params.id, 'member id');

  if (req.user.role === 'member' && req.user.member_id !== id) {
    throw ApiError.forbidden();
  }

  const [subscriptions, payments, attendance] = await Promise.all([
    q(
      `SELECT s.*, p.name as plan_name 
       FROM subscriptions s
       JOIN membership_plans p ON s.plan_id = p.id
       WHERE s.member_id = ?
       ORDER BY s.start_date DESC`,
      [id]
    ),
    q(
      `SELECT p.*, s.status as subscription_status, mp.name as plan_name
       FROM payments p
       LEFT JOIN subscriptions s ON p.subscription_id = s.id
       LEFT JOIN membership_plans mp ON s.plan_id = mp.id
       WHERE p.member_id = ?
       ORDER BY p.payment_date DESC`,
      [id]
    ),
    q(
      `SELECT a.*, u.full_name as recorded_by_name
       FROM attendance a
       LEFT JOIN users u ON a.recorded_by = u.id
       WHERE a.member_id = ?
       ORDER BY a.check_in DESC
       LIMIT 50`,
      [id]
    ),
  ]);

  ok(res, { subscriptions, payments, attendance });
}

