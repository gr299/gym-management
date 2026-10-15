import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { one } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tv: user.token_version }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[config.cookieName] || null;
}

/**
 * Verifies the JWT and re-loads the user so deactivated accounts, role changes and
 * logouts (token_version bump) take effect immediately.
 */
export async function authenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized());
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    return next(ApiError.unauthorized('Session expired or invalid. Please sign in again.'));
  }
  const user = await one(
    'SELECT id, full_name, email, role, member_id, trainer_id, is_active, token_version FROM users WHERE id = ?',
    [payload.sub],
  );
  if (!user || !user.is_active || user.token_version !== payload.tv) {
    return next(ApiError.unauthorized('Session expired or invalid. Please sign in again.'));
  }
  req.user = user;
  next();
}

/** Restricts a route to the given roles. */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  TRAINER: 'trainer',
  MEMBER: 'member',
};

export const MANAGERS = [ROLES.ADMIN, ROLES.STAFF];

