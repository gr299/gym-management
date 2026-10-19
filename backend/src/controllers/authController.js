import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { one, q } from '../config/db.js';
import { signToken } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../utils/validate.js';
import { logActivity, ok } from '../utils/helpers.js';

// Used to equalize timing when the email does not exist (prevents user enumeration).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 8,
  };
}

export function publicUser(u) {
  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    member_id: u.member_id,
    trainer_id: u.trainer_id,
  };
}

export async function login(req, res) {
  const { email, password } = validate(req.body, {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, maxLength: 200 },
  });
  const user = await one('SELECT * FROM users WHERE email = ?', [email]);
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) throw ApiError.unauthorized('Invalid email or password');
  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated. Contact an administrator.');

  await q('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  const token = signToken(user);
  res.cookie(config.cookieName, token, cookieOptions());
  req.user = user;
  await logActivity(req, 'login', 'user', user.id);
  // The token is also returned so API clients (curl/Postman) can use the Bearer header.
  // The browser app relies only on the httpOnly cookie and never stores the token.
  ok(res, { user: publicUser(user), token });
}

export async function logout(req, res) {
  // Bumping token_version revokes every token issued to this user.
  await q('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
  await logActivity(req, 'logout', 'user', req.user.id);
  res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
  ok(res, { message: 'Logged out' });
}

export async function me(req, res) {
  ok(res, { user: publicUser(req.user) });
}

export async function updateProfile(req, res) {
  const data = validate(req.body, {
    full_name: { type: 'string', required: true, maxLength: 120, label: 'Full name' },
    email: { type: 'email', required: true },
  });
  const clash = await one('SELECT id FROM users WHERE email = ? AND id <> ?', [data.email, req.user.id]);
  if (clash) throw ApiError.conflict('This email address is already in use');
  await q('UPDATE users SET full_name = ?, email = ? WHERE id = ?', [data.full_name, data.email, req.user.id]);
  await logActivity(req, 'update_profile', 'user', req.user.id);
  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  ok(res, { user: publicUser(user) });
}

export function checkPasswordStrength(password) {
  const problems = [];
  if (typeof password !== 'string' || password.length < 8) problems.push('at least 8 characters');
  if (!/[A-Za-z]/.test(password || '')) problems.push('a letter');
  if (!/[0-9]/.test(password || '')) problems.push('a number');
  return problems.length ? `Password must contain ${problems.join(', ')}` : null;
}

export async function changePassword(req, res) {
  const data = validate(req.body, {
    current_password: { type: 'string', required: true, label: 'Current password' },
    new_password: { type: 'string', required: true, maxLength: 200, label: 'New password' },
  });
  const weak = checkPasswordStrength(data.new_password);
  if (weak) throw ApiError.validation({ new_password: weak });
  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(data.current_password, user.password_hash))) {
    throw ApiError.validation({ current_password: 'Current password is incorrect' });
  }
  const hash = await bcrypt.hash(data.new_password, config.bcryptRounds);
  await q('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, user.id]);
  const updated = await one('SELECT * FROM users WHERE id = ?', [user.id]);
  res.cookie(config.cookieName, signToken(updated), cookieOptions());
  await logActivity(req, 'change_password', 'user', user.id);
  ok(res, { message: 'Password updated' });
}

