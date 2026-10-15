/** Reads ?page & ?limit (bounded) and returns { page, limit, offset }. */
export function getPagination(query, { defaultLimit = 10, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Maps a requested sort key onto a whitelist of SQL expressions (prevents SQL injection). */
export function getSort(query, allowed, fallback) {
  const key = Object.prototype.hasOwnProperty.call(allowed, query.sort) ? query.sort : fallback;
  const dir = String(query.order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${allowed[key]} ${dir}`;
}

export function paged(rows, total, { page, limit }) {
  return {
    data: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Builds a WHERE clause from fragments, e.g. where([['a = ?', 1], null, ['b LIKE ?', '%x%']]). */
export function buildWhere(conditions) {
  const clauses = [];
  const params = [];
  for (const c of conditions) {
    if (!c) continue;
    const [sql, ...values] = c;
    clauses.push(`(${sql})`);
    params.push(...values);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export function likeParam(term) {
  return `%${String(term).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

