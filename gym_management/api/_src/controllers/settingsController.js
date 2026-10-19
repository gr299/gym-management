import bcrypt from 'bcryptjs';
import { q, one } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { logActivity, ok } from '../utils/helpers.js';
import { getSettings, clearSettingsCache } from '../utils/settings.js';
import { config } from '../config/env.js';
import { checkPasswordStrength, publicUser } from './authController.js';

// --- Gym Settings ---

export async function getGymSettings(req, res) {
  const settings = await getSettings({ fresh: true });
  ok(res, settings);
}

export async function updateGymSettings(req, res) {
  const data = validate(req.body, {
    gym_name: { type: 'string', required: true, maxLength: 120 },
    address: { type: 'string', required: false, maxLength: 255 },
    phone: { type: 'phone', required: false },
    email: { type: 'email', required: false },
    currency: { type: 'string', required: true, minLength: 3, maxLength: 3 },
    timezone: { type: 'string', required: true, maxLength: 64 },
    grace_period_days: { type: 'int', required: false, min: 0, default: 0 },
    checkin_requires_payment: { type: 'bool', required: false, default: true },
    expiring_soon_days: { type: 'int', required: false, min: 1, default: 7 },
    default_session_minutes: { type: 'int', required: false, min: 15, default: 60 },
    receipt_footer: { type: 'string', required: false, maxLength: 255 },
  });

  await q(
    `UPDATE gym_settings SET
       gym_name = ?,
       address = ?,
       phone = ?,
       email = ?,
       currency = ?,
       timezone = ?,
       grace_period_days = ?,
       checkin_requires_payment = ?,
       expiring_soon_days = ?,
       default_session_minutes = ?,
       receipt_footer = ?,
       updated_by = ?
     WHERE id = 1`,
    [
      data.gym_name,
      data.address || null,
      data.phone || null,
      data.email || null,
      data.currency.toUpperCase(),
      data.timezone,
      data.grace_period_days,
      Boolean(data.checkin_requires_payment),
      data.expiring_soon_days,
      data.default_session_minutes,
      data.receipt_footer || null,
      req.user.id,
    ]
  );

  clearSettingsCache();
  await logActivity(req, 'update', 'gym_settings', 1, 'Updated gym configuration');
  const updated = await getSettings({ fresh: true });
  ok(res, updated);
}

// --- User Management (Admin only) ---

export async function listUsers(req, res) {
  const users = await q(
    `SELECT u.id, u.full_name, u.email, u.role, u.member_id, u.trainer_id, u.is_active, u.last_login_at, u.created_at,
            m.member_code,
            t.trainer_code
     FROM users u
     LEFT JOIN members m ON u.member_id = m.id
     LEFT JOIN trainers t ON u.trainer_id = t.id
     ORDER BY u.created_at DESC`
  );
  ok(res, users);
}

export async function createUser(req, res) {
  const data = validate(req.body, {
    full_name: { type: 'string', required: true, maxLength: 120 },
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, maxLength: 200 },
    role: { type: 'enum', values: ['admin', 'staff', 'trainer', 'member'], required: true },
    member_id: { type: 'id', required: false },
    trainer_id: { type: 'id', required: false },
    is_active: { type: 'bool', required: false, default: true },
  });

  const weakErr = checkPasswordStrength(data.password);
  if (weakErr) throw ApiError.validation({ password: weakErr });

  const existing = await one('SELECT id FROM users WHERE email = ?', [data.email]);
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const hash = await bcrypt.hash(data.password, config.bcryptRounds);

  const result = await q(
    `INSERT INTO users (full_name, email, password_hash, role, member_id, trainer_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.full_name,
      data.email,
      hash,
      data.role,
      data.member_id || null,
      data.trainer_id || null,
      Boolean(data.is_active),
    ]
  );

  await logActivity(req, 'create', 'user', result.insertId, `Created user ${data.email} (${data.role})`);
  const created = await one('SELECT * FROM users WHERE id = ?', [result.insertId]);
  ok(res, publicUser(created), 201);
}

export async function updateUser(req, res) {
  const id = parseId(req.params.id, 'user id');
  const existing = await one('SELECT * FROM users WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('User not found');

  const data = validate(
    req.body,
    {
      full_name: { type: 'string', required: true, maxLength: 120 },
      email: { type: 'email', required: true },
      role: { type: 'enum', values: ['admin', 'staff', 'trainer', 'member'], required: true },
      is_active: { type: 'bool', required: false },
      password: { type: 'string', required: false },
    },
    { partial: true }
  );

  if (data.email && data.email !== existing.email) {
    const clash = await one('SELECT id FROM users WHERE email = ? AND id != ?', [data.email, id]);
    if (clash) throw ApiError.conflict('Another user already has this email');
  }

  let hash = null;
  if (data.password) {
    const weakErr = checkPasswordStrength(data.password);
    if (weakErr) throw ApiError.validation({ password: weakErr });
    hash = await bcrypt.hash(data.password, config.bcryptRounds);
  }

  const nextIsActive = data.is_active !== undefined ? Boolean(data.is_active) : Boolean(existing.is_active);
  const bumpToken = hash !== null || !nextIsActive ? 1 : 0;

  await q(
    `UPDATE users SET
       full_name = COALESCE(?, full_name),
       email = COALESCE(?, email),
       role = COALESCE(?, role),
       is_active = ?,
       password_hash = COALESCE(?, password_hash),
       token_version = token_version + ?
     WHERE id = ?`,
    [
      data.full_name,
      data.email,
      data.role,
      nextIsActive,
      hash,
      bumpToken,
      id,
    ]
  );

  await logActivity(req, 'update', 'user', id, `Updated account ${existing.email}`);
  const updated = await one('SELECT * FROM users WHERE id = ?', [id]);
  ok(res, publicUser(updated));
}

