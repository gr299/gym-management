import { q, one, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { getPagination, buildWhere, likeParam, paged } from '../utils/query.js';
import { logActivity, ok, makeCode } from '../utils/helpers.js';

// --- Trainers ---

export async function listTrainers(req, res) {
  const { status, search } = req.query;
  const conditions = [];

  if (status) conditions.push(['t.status = ?', status]);
  if (search) {
    conditions.push([
      '(t.trainer_code LIKE ? OR t.full_name LIKE ? OR t.email LIKE ? OR t.specialization LIKE ?)',
      likeParam(search),
      likeParam(search),
      likeParam(search),
      likeParam(search),
    ]);
  }

  const { where, params } = buildWhere(conditions);

  const trainers = await q(
    `SELECT t.*, 
            COUNT(DISTINCT m.id) as assigned_members_count,
            COUNT(DISTINCT CASE WHEN s.status = 'scheduled' THEN s.id END) as upcoming_sessions_count
     FROM trainers t
     LEFT JOIN members m ON m.trainer_id = t.id AND m.status = 'active'
     LEFT JOIN training_sessions s ON s.trainer_id = t.id AND s.start_time >= CURRENT_TIMESTAMP
     ${where}
     GROUP BY t.id
     ORDER BY t.full_name ASC`,
    params
  );

  ok(res, trainers);
}

export async function getTrainer(req, res) {
  const id = parseId(req.params.id, 'trainer id');
  const trainer = await one('SELECT * FROM trainers WHERE id = ?', [id]);
  if (!trainer) throw ApiError.notFound('Trainer not found');

  const [assignedMembers, upcomingSessions] = await Promise.all([
    q(
      `SELECT id, member_code, first_name, last_name, email, phone, status 
       FROM members 
       WHERE trainer_id = ? AND status = 'active'
       ORDER BY last_name ASC`,
      [id]
    ),
    q(
      `SELECT ts.*, m.member_code, m.first_name, m.last_name
       FROM training_sessions ts
       JOIN members m ON ts.member_id = m.id
       WHERE ts.trainer_id = ? AND ts.start_time >= CURRENT_TIMESTAMP
       ORDER BY ts.start_time ASC
       LIMIT 10`,
      [id]
    ),
  ]);

  ok(res, { ...trainer, assignedMembers, upcomingSessions });
}

export async function createTrainer(req, res) {
  const data = validate(req.body, {
    full_name: { type: 'string', required: true, maxLength: 120 },
    email: { type: 'email', required: true },
    phone: { type: 'phone', required: false },
    specialization: { type: 'string', required: false, maxLength: 120 },
    experience_years: { type: 'int', required: false, min: 0, default: 0 },
    availability: { type: 'string', required: false, maxLength: 255 },
    status: { type: 'enum', values: ['active', 'on_leave', 'inactive'], required: false, default: 'active' },
    bio: { type: 'string', required: false },
  });

  const existing = await one('SELECT id FROM trainers WHERE email = ?', [data.email]);
  if (existing) throw ApiError.conflict('A trainer with this email already exists');

  const result = await withTransaction(async (conn) => {
    const tempCode = `TRN-TMP-${Date.now()}`;
    const [ins] = await conn.query(
      `INSERT INTO trainers (trainer_code, full_name, email, phone, specialization, experience_years, availability, status, bio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tempCode,
        data.full_name,
        data.email,
        data.phone || null,
        data.specialization || null,
        data.experience_years,
        data.availability || null,
        data.status,
        data.bio || null,
      ]
    );

    const trainerId = ins.insertId;
    const realCode = makeCode('TRN', trainerId);
    await conn.query('UPDATE trainers SET trainer_code = ? WHERE id = ?', [realCode, trainerId]);
    return { trainerId, realCode };
  });

  await logActivity(req, 'create', 'trainer', result.trainerId, `Added trainer ${result.realCode}`);
  const created = await one('SELECT * FROM trainers WHERE id = ?', [result.trainerId]);
  ok(res, created, 201);
}

export async function updateTrainer(req, res) {
  const id = parseId(req.params.id, 'trainer id');
  const existing = await one('SELECT * FROM trainers WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Trainer not found');

  const data = validate(
    req.body,
    {
      full_name: { type: 'string', required: true, maxLength: 120 },
      email: { type: 'email', required: true },
      phone: { type: 'phone', required: false },
      specialization: { type: 'string', required: false, maxLength: 120 },
      experience_years: { type: 'int', required: false, min: 0 },
      availability: { type: 'string', required: false, maxLength: 255 },
      status: { type: 'enum', values: ['active', 'on_leave', 'inactive'], required: false },
      bio: { type: 'string', required: false },
    },
    { partial: true }
  );

  if (data.email && data.email !== existing.email) {
    const clash = await one('SELECT id FROM trainers WHERE email = ? AND id != ?', [data.email, id]);
    if (clash) throw ApiError.conflict('Another trainer already has this email');
  }

  await q(
    `UPDATE trainers SET
       full_name = COALESCE(?, full_name),
       email = COALESCE(?, email),
       phone = ?,
       specialization = ?,
       experience_years = COALESCE(?, experience_years),
       availability = ?,
       status = COALESCE(?, status),
       bio = ?
     WHERE id = ?`,
    [
      data.full_name,
      data.email,
      data.phone !== undefined ? data.phone : existing.phone,
      data.specialization !== undefined ? data.specialization : existing.specialization,
      data.experience_years,
      data.availability !== undefined ? data.availability : existing.availability,
      data.status,
      data.bio !== undefined ? data.bio : existing.bio,
      id,
    ]
  );

  await logActivity(req, 'update', 'trainer', id, `Updated trainer ${existing.trainer_code}`);
  const updated = await one('SELECT * FROM trainers WHERE id = ?', [id]);
  ok(res, updated);
}

// --- Training Sessions (Scheduling) ---

export async function listSessions(req, res) {
  const { trainer_id, member_id, status, from_date, to_date } = req.query;
  const conditions = [];

  if (req.user.role === 'trainer') {
    conditions.push(['ts.trainer_id = ?', req.user.trainer_id]);
  } else if (trainer_id) {
    conditions.push(['ts.trainer_id = ?', parseId(trainer_id)]);
  }

  if (req.user.role === 'member') {
    conditions.push(['ts.member_id = ?', req.user.member_id]);
  } else if (member_id) {
    conditions.push(['ts.member_id = ?', parseId(member_id)]);
  }

  if (status) conditions.push(['ts.status = ?', status]);
  if (from_date) conditions.push(['ts.start_time >= ?', `${from_date} 00:00:00`]);
  if (to_date) conditions.push(['ts.end_time <= ?', `${to_date} 23:59:59`]);

  const { where, params } = buildWhere(conditions);

  const sessions = await q(
    `SELECT ts.*,
            t.full_name as trainer_name, t.trainer_code,
            m.first_name as member_first_name, m.last_name as member_last_name, m.member_code
     FROM training_sessions ts
     JOIN trainers t ON ts.trainer_id = t.id
     JOIN members m ON ts.member_id = m.id
     ${where}
     ORDER BY ts.start_time ASC`,
    params
  );

  ok(res, sessions);
}

export async function createSession(req, res) {
  const data = validate(req.body, {
    trainer_id: { type: 'id', required: true },
    member_id: { type: 'id', required: true },
    title: { type: 'string', required: false, maxLength: 120, default: 'Personal Training Session' },
    start_time: { type: 'datetime', required: true },
    end_time: { type: 'datetime', required: true },
    notes: { type: 'string', required: false, maxLength: 500 },
  });

  if (new Date(data.end_time) <= new Date(data.start_time)) {
    throw ApiError.badRequest('End time must be after start time');
  }

  // Prevent conflicting bookings for the same trainer (Requirement 9)
  const conflict = await one(
    `SELECT id, title, start_time, end_time 
     FROM training_sessions 
     WHERE trainer_id = ? 
       AND status = 'scheduled'
       AND start_time < ? 
       AND end_time > ?`,
    [data.trainer_id, data.end_time, data.start_time]
  );

  if (conflict) {
    throw ApiError.conflict('Trainer already has a scheduled session during this time slot.');
  }

  const result = await q(
    `INSERT INTO training_sessions (trainer_id, member_id, title, start_time, end_time, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?)`,
    [data.trainer_id, data.member_id, data.title, data.start_time, data.end_time, data.notes || null, req.user.id]
  );

  await logActivity(req, 'create', 'training_session', result.insertId, `Scheduled session with trainer #${data.trainer_id}`);
  const created = await one(
    `SELECT ts.*, t.full_name as trainer_name, m.first_name, m.last_name 
     FROM training_sessions ts
     JOIN trainers t ON ts.trainer_id = t.id
     JOIN members m ON ts.member_id = m.id
     WHERE ts.id = ?`,
    [result.insertId]
  );
  ok(res, created, 201);
}

export async function updateSessionStatus(req, res) {
  const id = parseId(req.params.id, 'session id');
  const data = validate(req.body, {
    status: { type: 'enum', values: ['scheduled', 'completed', 'cancelled', 'no_show'], required: true },
    cancel_reason: { type: 'string', required: false, maxLength: 255 },
    notes: { type: 'string', required: false, maxLength: 500 },
  });

  const session = await one('SELECT * FROM training_sessions WHERE id = ?', [id]);
  if (!session) throw ApiError.notFound('Training session not found');

  if (req.user.role === 'trainer' && session.trainer_id !== req.user.trainer_id) {
    throw ApiError.forbidden();
  }

  await q(
    `UPDATE training_sessions 
     SET status = ?, 
         cancel_reason = COALESCE(?, cancel_reason), 
         notes = COALESCE(?, notes) 
     WHERE id = ?`,
    [data.status, data.cancel_reason || null, data.notes || null, id]
  );

  await logActivity(req, 'update_status', 'training_session', id, `Updated session status to ${data.status}`);
  const updated = await one('SELECT * FROM training_sessions WHERE id = ?', [id]);
  ok(res, updated);
}

