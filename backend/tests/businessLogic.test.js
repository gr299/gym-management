import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEndDate, addDays, addMonths, isValidDateString } from '../src/utils/dates.js';
import { checkPasswordStrength } from '../src/controllers/authController.js';
import { validate } from '../src/utils/validate.js';
import { ApiError } from '../src/utils/ApiError.js';

test('Dates: validation', () => {
  assert.equal(isValidDateString('2026-05-15'), true);
  assert.equal(isValidDateString('2026-02-29'), false); // 2026 is not leap year
  assert.equal(isValidDateString('invalid-date'), false);
  assert.equal(isValidDateString(''), false);
});

test('Dates: calculateEndDate for various units', () => {
  // 1 day pass starting 2026-01-10 should expire on 2026-01-10
  assert.equal(calculateEndDate('2026-01-10', 1, 'day'), '2026-01-10');

  // 7 days (1 week) starting 2026-01-10 expires 2026-01-16
  assert.equal(calculateEndDate('2026-01-10', 1, 'week'), '2026-01-16');

  // 1 month starting 2026-01-10 expires 2026-02-09
  assert.equal(calculateEndDate('2026-01-10', 1, 'month'), '2026-02-09');

  // 1 year starting 2026-01-01 expires 2026-12-31
  assert.equal(calculateEndDate('2026-01-01', 1, 'year'), '2026-12-31');

  // Clamping at end of month (e.g. Jan 31 + 1 month clamps to Feb 28)
  assert.equal(calculateEndDate('2026-01-31', 1, 'month'), '2026-02-27');
});

test('Auth: checkPasswordStrength', () => {
  assert.notEqual(checkPasswordStrength('short'), null);
  assert.notEqual(checkPasswordStrength('alllettersonly'), null);
  assert.notEqual(checkPasswordStrength('12345678'), null);
  assert.equal(checkPasswordStrength('ValidPass123'), null);
});

test('Validation: rules engine', () => {
  const rules = {
    name: { type: 'string', required: true },
    email: { type: 'email', required: true },
    price: { type: 'money', required: true },
    role: { type: 'enum', values: ['admin', 'staff'], required: true },
  };

  const valid = validate(
    { name: ' John Doe ', email: 'JOHN@EXAMPLE.COM', price: 99.994, role: 'admin' },
    rules
  );

  assert.equal(valid.name, 'John Doe');
  assert.equal(valid.email, 'john@example.com');
  assert.equal(valid.price, 99.99); // rounded money
  assert.equal(valid.role, 'admin');

  assert.throws(
    () => validate({ name: 'Jane', email: 'not-an-email', price: -5, role: 'superman' }, rules),
    (err) => err instanceof ApiError && err.status === 422
  );
});

