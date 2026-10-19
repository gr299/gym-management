// Pure date helpers. Calendar dates are 'YYYY-MM-DD' strings; instants are JS Dates (UTC).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtcDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(dt) {
  return dt.toISOString().slice(0, 10);
}

/** Calendar date ('YYYY-MM-DD') of the given instant in an IANA timezone. */
export function dateInTimeZone(instant = new Date(), timeZone = 'Asia/Manila') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Offset (minutes) of timeZone from UTC at the given instant, e.g. +480 for Asia/Manila. */
export function timeZoneOffsetMinutes(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** UTC instant at which the local calendar date begins in timeZone. */
export function startOfLocalDayUtc(dateStr, timeZone) {
  const guess = toUtcDate(dateStr);
  const offset = timeZoneOffsetMinutes(guess, timeZone);
  let result = new Date(guess.getTime() - offset * 60000);
  const offset2 = timeZoneOffsetMinutes(result, timeZone);
  if (offset2 !== offset) result = new Date(guess.getTime() - offset2 * 60000);
  return result;
}

/** [startUtc, endUtcExclusive) covering local dates from..to inclusive. */
export function localDateRangeUtc(from, to, timeZone) {
  return [startOfLocalDayUtc(from, timeZone), startOfLocalDayUtc(addDays(to, 1), timeZone)];
}

export function addDays(dateStr, days) {
  const dt = toUtcDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fmt(dt);
}

/** Adds months, clamping to the last day of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetMonthIndex = m - 1 + months;
  const ty = y + Math.floor(targetMonthIndex / 12);
  const tm = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(ty, tm, Math.min(d, lastDay))));
}

/**
 * Inclusive expiration date for a membership starting on startDate.
 * A 1-day pass starting 2026-01-10 expires 2026-01-10; a 1-month plan from 2026-01-10 expires 2026-02-09.
 */
export function calculateEndDate(startDate, durationValue, durationUnit) {
  if (!isValidDateString(startDate)) throw new Error('Invalid start date');
  const n = Number(durationValue);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Duration must be a positive integer');
  let exclusiveEnd;
  switch (durationUnit) {
    case 'day':
      exclusiveEnd = addDays(startDate, n);
      break;
    case 'week':
      exclusiveEnd = addDays(startDate, n * 7);
      break;
    case 'month':
      exclusiveEnd = addMonths(startDate, n);
      break;
    case 'year':
      exclusiveEnd = addMonths(startDate, n * 12);
      break;
    default:
      throw new Error(`Unsupported duration unit: ${durationUnit}`);
  }
  return addDays(exclusiveEnd, -1);
}

export function diffDays(fromDate, toDate) {
  return Math.round((toUtcDate(toDate) - toUtcDate(fromDate)) / 86400000);
}

export function startOfMonth(dateStr) {
  return `${dateStr.slice(0, 7)}-01`;
}

export function endOfMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return fmt(new Date(Date.UTC(y, m, 0)));
}

