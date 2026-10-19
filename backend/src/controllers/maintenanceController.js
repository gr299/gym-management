import { q, one, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { getPagination, getSort, buildWhere, likeParam, paged } from '../utils/query.js';
import { logActivity, ok } from '../utils/helpers.js';
import { calculateEndDate, addDays } from '../utils/dates.js';
import { gymToday } from '../utils/settings.js';

export async function listMaintenance(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { equipment_id, status, priority, type, overdue_only } = req.query;

  const conditions = [];

  if (equipment_id) conditions.push(['mr.equipment_id = ?', parseId(equipment_id)]);
  if (status) conditions.push(['mr.status = ?', status]);
  if (priority) conditions.push(['mr.priority = ?', priority]);
  if (type) conditions.push(['mr.maintenance_type = ?', type]);

  if (overdue_only === 'true' || overdue_only === '1') {
    const today = await gymToday();
    conditions.push([
      "mr.status IN ('reported', 'scheduled') AND mr.scheduled_date IS NOT NULL AND mr.scheduled_date < ?",
      today,
    ]);
  }

  const { where, params } = buildWhere(conditions);

  const countRow = await one(
    `SELECT COUNT(*) as total FROM maintenance_records mr ${where}`,
    params
  );
  const total = countRow ? Number(countRow.total) : 0;

  const sortSql = getSort(
    req.query,
    {
      reported_date: 'mr.reported_date',
      scheduled_date: 'mr.scheduled_date',
      cost: 'mr.cost',
      priority: 'mr.priority',
    },
    'reported_date'
  );

  const rows = await q(
    `SELECT mr.*,
            e.equipment_code, e.name as equipment_name, e.category, e.location,
            u.full_name as reported_by_name
     FROM maintenance_records mr
     JOIN equipment e ON mr.equipment_id = e.id
     LEFT JOIN users u ON mr.reported_by = u.id
     ${where}
     ORDER BY ${sortSql}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  ok(res, paged(rows, total, { page, limit }));
}

export async function createMaintenance(req, res) {
  const today = await gymToday();
  const data = validate(req.body, {
    equipment_id: { type: 'id', required: true },
    issue_description: { type: 'string', required: true, maxLength: 500 },
    maintenance_type: {
      type: 'enum',
      values: ['preventive', 'corrective', 'inspection', 'repair', 'replacement'],
      required: true,
    },
    priority: { type: 'enum', values: ['low', 'medium', 'high', 'critical'], required: false, default: 'medium' },
    reported_date: { type: 'date', required: false, default: today },
    scheduled_date: { type: 'date', required: false },
    technician: { type: 'string', required: false, maxLength: 120 },
    cost: { type: 'money', required: false, default: 0 },
    affected_qty: { type: 'int', required: false, min: 0, default: 1 },
    update_equipment_status: { type: 'bool', required: false, default: true },
    notes: { type: 'string', required: false },
  });

  const equipment = await one('SELECT * FROM equipment WHERE id = ?', [data.equipment_id]);
  if (!equipment) throw ApiError.notFound('Equipment not found');

  const result = await withTransaction(async (conn) => {
    const [ins] = await conn.query(
      `INSERT INTO maintenance_records (equipment_id, issue_description, maintenance_type, priority, reported_date, scheduled_date, technician, cost, status, affected_qty, notes, reported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reported', ?, ?, ?)`,
      [
        data.equipment_id,
        data.issue_description,
        data.maintenance_type,
        data.priority,
        data.reported_date,
        data.scheduled_date || null,
        data.technician || null,
        data.cost,
        data.affected_qty,
        data.notes || null,
        req.user.id,
      ]
    );

    // If configured to automatically update equipment status to reflect repair need (Requirement 12)
    if (data.update_equipment_status) {
      await conn.query(
        `UPDATE equipment 
         SET status = 'under_maintenance',
             out_of_service_qty = LEAST(quantity, out_of_service_qty + ?)
         WHERE id = ?`,
        [data.affected_qty, data.equipment_id]
      );
    }

    return ins.insertId;
  });

  await logActivity(
    req,
    'create',
    'maintenance_record',
    result,
    `Logged maintenance for ${equipment.equipment_code}`
  );
  const created = await one(
    `SELECT mr.*, e.name as equipment_name, e.equipment_code 
     FROM maintenance_records mr 
     JOIN equipment e ON mr.equipment_id = e.id 
     WHERE mr.id = ?`,
    [result]
  );
  ok(res, created, 201);
}

export async function completeMaintenance(req, res) {
  const id = parseId(req.params.id, 'maintenance record id');
  const record = await one('SELECT * FROM maintenance_records WHERE id = ?', [id]);
  if (!record) throw ApiError.notFound('Maintenance record not found');
  if (record.status === 'completed') throw ApiError.badRequest('This maintenance is already marked completed');

  const today = await gymToday();
  const data = validate(req.body, {
    completed_date: { type: 'date', required: false, default: today },
    cost: { type: 'money', required: false },
    condition_after: {
      type: 'enum',
      values: ['excellent', 'good', 'fair', 'poor', 'damaged'],
      required: false,
      default: 'good',
    },
    technician: { type: 'string', required: false, maxLength: 120 },
    notes: { type: 'string', required: false },
  });

  const equipment = await one('SELECT * FROM equipment WHERE id = ?', [record.equipment_id]);

  await withTransaction(async (conn) => {
    const completedNote = data.notes ? `[Completed] ${data.notes}` : '';
    const mergedNotes = [record.notes, completedNote].filter(Boolean).join('\n') || null;

    await conn.query(
      `UPDATE maintenance_records SET
         status = 'completed',
         completed_date = ?,
         cost = COALESCE(?, cost),
         condition_after = ?,
         technician = COALESCE(?, technician),
         notes = ?
       WHERE id = ?`,
      [
        data.completed_date,
        data.cost,
        data.condition_after,
        data.technician,
        mergedNotes,
        id,
      ]
    );

    // Calculate next maintenance date if interval is configured on equipment
    let nextMaintDate = equipment.next_maintenance_date;
    if (equipment.maintenance_interval_days) {
      nextMaintDate = addDays(data.completed_date, equipment.maintenance_interval_days);
    }

    // Restore equipment availability and condition
    await conn.query(
      `UPDATE equipment SET
         status = 'available',
         \`condition\` = ?,
         out_of_service_qty = GREATEST(0, out_of_service_qty - ?),
         last_maintenance_date = ?,
         next_maintenance_date = ?
       WHERE id = ?`,
      [data.condition_after, record.affected_qty, data.completed_date, nextMaintDate, record.equipment_id]
    );
  });

  await logActivity(
    req,
    'complete',
    'maintenance_record',
    id,
    `Completed maintenance #${id} for equipment #${record.equipment_id}`
  );
  const updated = await one('SELECT * FROM maintenance_records WHERE id = ?', [id]);
  ok(res, updated);
}

