import { ApiError } from './ApiError.js';
import { isValidDateString } from './dates.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

/**
 * Validates and normalizes input against a rule map.
 *   rules = { field: { type, required, min, max, maxLength, values, label, default } }
 * types: string | email | phone | int | number | money | bool | date | datetime | enum | id
 * With { partial: true } missing fields are skipped (for PATCH-like updates).
 * Returns a clean object containing only declared fields; throws ApiError 422 on failure.
 */
export function validate(input, rules, { partial = false } = {}) {
  const data = input && typeof input === 'object' ? input : {};
  const errors = {};
  const out = {};

  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field.replace(/_/g, ' ');
    let value = data[field];
    if (typeof value === 'string') value = value.trim();
    const missing = value === undefined || value === null || value === '';

    if (missing) {
      if (partial && value === undefined) continue;
      if (rule.required) {
        errors[field] = `${label} is required`;
        continue;
      }
      out[field] = rule.default !== undefined ? rule.default : null;
      continue;
    }

    const fail = (msg) => {
      errors[field] = msg;
    };

    switch (rule.type || 'string') {
      case 'string': {
        value = String(value);
        if (rule.maxLength && value.length > rule.maxLength) fail(`${label} must be at most ${rule.maxLength} characters`);
        if (rule.minLength && value.length < rule.minLength) fail(`${label} must be at least ${rule.minLength} characters`);
        break;
      }
      case 'email': {
        value = String(value).toLowerCase();
        if (!EMAIL_RE.test(value) || value.length > 160) fail(`${label} must be a valid email address`);
        break;
      }
      case 'phone': {
        value = String(value);
        if (!PHONE_RE.test(value)) fail(`${label} must be a valid phone number`);
        break;
      }
      case 'id':
      case 'int': {
        const n = Number(value);
        if (!Number.isInteger(n)) {
          fail(`${label} must be a whole number`);
          break;
        }
        if (rule.type === 'id' && n <= 0) fail(`${label} is invalid`);
        if (rule.min !== undefined && n < rule.min) fail(`${label} must be at least ${rule.min}`);
        if (rule.max !== undefined && n > rule.max) fail(`${label} must be at most ${rule.max}`);
        value = n;
        break;
      }
      case 'number':
      case 'money': {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          fail(`${label} must be a number`);
          break;
        }
        const min = rule.min ?? (rule.type === 'money' ? 0 : undefined);
        if (min !== undefined && n < min) fail(`${label} must be at least ${min}`);
        if (rule.max !== undefined && n > rule.max) fail(`${label} must be at most ${rule.max}`);
        value = rule.type === 'money' ? Math.round(n * 100) / 100 : n;
        break;
      }
      case 'bool': {
        if (typeof value === 'boolean') break;
        if (value === 1 || value === '1' || value === 'true') value = true;
        else if (value === 0 || value === '0' || value === 'false') value = false;
        else fail(`${label} must be true or false`);
        break;
      }
      case 'date': {
        if (!isValidDateString(String(value))) fail(`${label} must be a valid date (YYYY-MM-DD)`);
        value = String(value);
        break;
      }
      case 'datetime': {
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) fail(`${label} must be a valid date and time`);
        value = dt;
        break;
      }
      case 'enum': {
        if (!rule.values.includes(value)) fail(`${label} must be one of: ${rule.values.join(', ')}`);
        break;
      }
      default:
        throw new Error(`Unknown validation type ${rule.type}`);
    }
    if (!errors[field]) out[field] = value;
  }

  if (Object.keys(errors).length) throw ApiError.validation(errors);
  return out;
}

/** Parses a positive integer route parameter or throws 400. */
export function parseId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw ApiError.badRequest(`Invalid ${label}`);
  return n;
}
