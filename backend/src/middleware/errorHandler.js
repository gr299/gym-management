import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/env.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

const MYSQL_ERRORS = {
  ER_DUP_ENTRY: [409, 'A record with the same unique value already exists'],
  ER_ROW_IS_REFERENCED_2: [409, 'This record is referenced by other records and cannot be deleted'],
  ER_NO_REFERENCED_ROW_2: [422, 'A referenced record does not exist'],
  ER_CHECK_CONSTRAINT_VIOLATED: [422, 'The data violates a database constraint'],
  ER_CONSTRAINT_FAILED: [422, 'The data violates a database constraint'],
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, errors: err.details });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  }
  if (err?.code && MYSQL_ERRORS[err.code]) {
    const [status, message] = MYSQL_ERRORS[err.code];
    let detail = message;
    if (err.code === 'ER_DUP_ENTRY') {
      if (/email/i.test(err.sqlMessage)) detail = 'This email address is already registered';
      else if (/idem/i.test(err.sqlMessage)) detail = 'This payment was already submitted';
    }
    return res.status(status).json({ success: false, message: detail });
  }
  if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'].includes(err?.code)) {
    console.error('Database unavailable:', err.code);
    return res.status(503).json({ success: false, message: 'Database is unavailable. Please try again later.' });
  }
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred',
    ...(config.isProd ? {} : { debug: err?.message }),
  });
}

