import { q, one, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { logActivity, ok } from '../utils/helpers.js';
import { gymToday } from '../utils/settings.js';

export async function listWorkoutPlans(req, res) {
  const { member_id, trainer_id, status } = req.query;
  const conditions = [];
  const params = [];

  if (req.user.role === 'member') {
    conditions.push('wp.member_id = ?');
    params.push(req.user.member_id);
  } else if (member_id) {
    conditions.push('wp.member_id = ?');
    params.push(parseId(member_id));
  }

  if (req.user.role === 'trainer') {
    conditions.push('(wp.trainer_id = ? OR wp.trainer_id IS NULL)');
    params.push(req.user.trainer_id);
  } else if (trainer_id) {
    conditions.push('wp.trainer_id = ?');
    params.push(parseId(trainer_id));
  }

  if (status) {
    conditions.push('wp.status = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const plans = await q(
    `SELECT wp.*,
            m.first_name as member_first_name, m.last_name as member_last_name, m.member_code,
            t.full_name as trainer_name,
            COUNT(we.id) as total_exercises
     FROM workout_plans wp
     JOIN members m ON wp.member_id = m.id
     LEFT JOIN trainers t ON wp.trainer_id = t.id
     LEFT JOIN workout_exercises we ON we.plan_id = wp.id
     ${where}
     GROUP BY wp.id
     ORDER BY wp.created_at DESC`,
    params
  );

  ok(res, plans);
}

export async function getWorkoutPlan(req, res) {
  const id = parseId(req.params.id, 'workout plan id');

  const plan = await one(
    `SELECT wp.*,
            m.first_name as member_first_name, m.last_name as member_last_name, m.member_code,
            t.full_name as trainer_name
     FROM workout_plans wp
     JOIN members m ON wp.member_id = m.id
     LEFT JOIN trainers t ON wp.trainer_id = t.id
     WHERE wp.id = ?`,
    [id]
  );
  if (!plan) throw ApiError.notFound('Workout plan not found');

  if (req.user.role === 'member' && plan.member_id !== req.user.member_id) {
    throw ApiError.forbidden();
  }

  const exercises = await q(
    'SELECT * FROM workout_exercises WHERE plan_id = ? ORDER BY sort_order ASC, id ASC',
    [id]
  );

  const logs = await q(
    `SELECT wl.*, u.full_name as logged_by_name
     FROM workout_logs wl
     LEFT JOIN users u ON wl.logged_by = u.id
     WHERE wl.plan_id = ?
     ORDER BY wl.completed_on DESC LIMIT 30`,
    [id]
  );

  ok(res, { ...plan, exercises, logs });
}

export async function createWorkoutPlan(req, res) {
  const data = validate(req.body, {
    name: { type: 'string', required: true, maxLength: 120 },
    member_id: { type: 'id', required: true },
    trainer_id: { type: 'id', required: false },
    goal: { type: 'string', required: false, maxLength: 255 },
    schedule: { type: 'string', required: false, maxLength: 255 },
    start_date: { type: 'date', required: false },
    end_date: { type: 'date', required: false },
    notes: { type: 'string', required: false },
  });

  const member = await one('SELECT id, status FROM members WHERE id = ?', [data.member_id]);
  if (!member) throw ApiError.notFound('Member not found');

  const trainerId = req.user.role === 'trainer' ? req.user.trainer_id : data.trainer_id || null;

  const exercises = Array.isArray(req.body.exercises) ? req.body.exercises : [];

  const planId = await withTransaction(async (conn) => {
    const [ins] = await conn.query(
      `INSERT INTO workout_plans (name, member_id, trainer_id, goal, schedule, start_date, end_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        data.name,
        data.member_id,
        trainerId,
        data.goal || null,
        data.schedule || null,
        data.start_date || null,
        data.end_date || null,
        data.notes || null,
        req.user.id,
      ]
    );

    const id = ins.insertId;

    if (exercises.length > 0) {
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        if (!ex.exercise_name) continue;
        await conn.query(
          `INSERT INTO workout_exercises (plan_id, day_label, exercise_name, sets, reps, weight, rest_seconds, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            ex.day_label || null,
            ex.exercise_name,
            Math.max(1, parseInt(ex.sets, 10) || 3),
            String(ex.reps || '10'),
            ex.weight ? String(ex.weight) : null,
            ex.rest_seconds ? parseInt(ex.rest_seconds, 10) : null,
            ex.notes || null,
            i + 1,
          ]
        );
      }
    }

    return id;
  });

  await logActivity(req, 'create', 'workout_plan', planId, `Created workout plan "${data.name}"`);
  const created = await one('SELECT * FROM workout_plans WHERE id = ?', [planId]);
  ok(res, created, 201);
}

export async function updateWorkoutPlan(req, res) {
  const id = parseId(req.params.id, 'workout plan id');
  const existing = await one('SELECT * FROM workout_plans WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Workout plan not found');

  const data = validate(
    req.body,
    {
      name: { type: 'string', required: true, maxLength: 120 },
      goal: { type: 'string', required: false, maxLength: 255 },
      schedule: { type: 'string', required: false, maxLength: 255 },
      start_date: { type: 'date', required: false },
      end_date: { type: 'date', required: false },
      status: { type: 'enum', values: ['active', 'completed', 'archived'], required: false },
      notes: { type: 'string', required: false },
    },
    { partial: true }
  );

  const exercises = Array.isArray(req.body.exercises) ? req.body.exercises : null;

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE workout_plans SET
         name = COALESCE(?, name),
         goal = ?,
         schedule = ?,
         start_date = ?,
         end_date = ?,
         status = COALESCE(?, status),
         notes = ?
       WHERE id = ?`,
      [
        data.name,
        data.goal !== undefined ? data.goal : existing.goal,
        data.schedule !== undefined ? data.schedule : existing.schedule,
        data.start_date !== undefined ? data.start_date : existing.start_date,
        data.end_date !== undefined ? data.end_date : existing.end_date,
        data.status,
        data.notes !== undefined ? data.notes : existing.notes,
        id,
      ]
    );

    if (exercises !== null) {
      await conn.query('DELETE FROM workout_exercises WHERE plan_id = ?', [id]);
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        if (!ex.exercise_name) continue;
        await conn.query(
          `INSERT INTO workout_exercises (plan_id, day_label, exercise_name, sets, reps, weight, rest_seconds, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            ex.day_label || null,
            ex.exercise_name,
            Math.max(1, parseInt(ex.sets, 10) || 3),
            String(ex.reps || '10'),
            ex.weight ? String(ex.weight) : null,
            ex.rest_seconds ? parseInt(ex.rest_seconds, 10) : null,
            ex.notes || null,
            i + 1,
          ]
        );
      }
    }
  });

  await logActivity(req, 'update', 'workout_plan', id, `Updated workout plan #${id}`);
  const updated = await one('SELECT * FROM workout_plans WHERE id = ?', [id]);
  ok(res, updated);
}

export async function logWorkoutCompletion(req, res) {
  const planId = parseId(req.params.id, 'workout plan id');
  const plan = await one('SELECT * FROM workout_plans WHERE id = ?', [planId]);
  if (!plan) throw ApiError.notFound('Workout plan not found');

  const today = await gymToday();
  const data = validate(req.body, {
    completed_on: { type: 'date', required: false, default: today },
    notes: { type: 'string', required: false, maxLength: 255 },
  });

  await q(
    `INSERT INTO workout_logs (plan_id, completed_on, notes, logged_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE notes = VALUES(notes), logged_by = VALUES(logged_by)`,
    [planId, data.completed_on, data.notes || null, req.user.id]
  );

  await logActivity(req, 'log_completion', 'workout_plan', planId, `Logged workout on ${data.completed_on}`);
  ok(res, { message: 'Workout logged successfully', completed_on: data.completed_on });
}

