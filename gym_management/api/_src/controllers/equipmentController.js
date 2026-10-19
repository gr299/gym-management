import { q, one, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { validate, parseId } from '../utils/validate.js';
import { getPagination, getSort, buildWhere, likeParam, paged } from '../utils/query.js';
import { logActivity, ok, makeCode } from '../utils/helpers.js';
import { gymToday } from '../utils/settings.js';

export async function listEquipment(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { category, condition, status, needs_maintenance, search } = req.query;

  const conditions = [];

  if (category) conditions.push(['e.category = ?', category]);
  if (condition) conditions.push(['e.condition = ?', condition]);
  if (status) conditions.push(['e.status = ?', status]);

  if (needs_maintenance === 'true' || needs_maintenance === '1') {
    const today = await gymToday();
    conditions.push([
      "(e.status IN ('damaged', 'under_maintenance') OR (e.next_maintenance_date IS NOT NULL AND e.next_maintenance_date <= ?))",
      today,
    ]);
  }

  if (search) {
    conditions.push([
      '(e.equipment_code LIKE ? OR e.name LIKE ? OR e.brand LIKE ? OR e.model LIKE ? OR e.location LIKE ?)',
      likeParam(search),
      likeParam(search),
      likeParam(search),
      likeParam(search),
      likeParam(search),
    ]);
  }

  const { where, params } = buildWhere(conditions);

  const countRow = await one(
    `SELECT COUNT(*) as total FROM equipment e ${where}`,
    params
  );
  const total = countRow ? Number(countRow.total) : 0;

  const sortSql = getSort(
    req.query,
    {
      name: 'e.name',
      category: 'e.category',
      status: 'e.status',
      condition: 'e.condition',
      next_maintenance_date: 'e.next_maintenance_date',
    },
    'name'
  );

  const rows = await q(
    `SELECT e.*, 
            (SELECT COUNT(*) FROM maintenance_records mr WHERE mr.equipment_id = e.id AND mr.status IN ('reported', 'scheduled', 'in_progress')) as open_maintenance_count
     FROM equipment e
     ${where}
     ORDER BY ${sortSql}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  ok(res, paged(rows, total, { page, limit }));
}

export async function getEquipment(req, res) {
  const id = parseId(req.params.id, 'equipment id');
  const item = await one('SELECT * FROM equipment WHERE id = ?', [id]);
  if (!item) throw ApiError.notFound('Equipment not found');

  const [purchases, maintenanceHistory] = await Promise.all([
    q('SELECT * FROM equipment_purchases WHERE equipment_id = ? ORDER BY purchase_date DESC', [id]),
    q(
      `SELECT mr.*, u.full_name as reported_by_name
       FROM maintenance_records mr
       LEFT JOIN users u ON mr.reported_by = u.id
       WHERE mr.equipment_id = ?
       ORDER BY mr.reported_date DESC`,
      [id]
    ),
  ]);

  ok(res, { ...item, purchases, maintenanceHistory });
}

export async function createEquipment(req, res) {
  const data = validate(req.body, {
    name: { type: 'string', required: true, maxLength: 120 },
    category: {
      type: 'enum',
      values: ['free_weights', 'cardio', 'strength_machine', 'functional', 'accessories', 'other'],
      required: true,
    },
    brand: { type: 'string', required: false, maxLength: 80 },
    model: { type: 'string', required: false, maxLength: 80 },
    quantity: { type: 'int', required: true, min: 1, default: 1 },
    purchase_date: { type: 'date', required: false },
    purchase_price: { type: 'money', required: false },
    location: { type: 'string', required: false, maxLength: 120 },
    condition: {
      type: 'enum',
      values: ['excellent', 'good', 'fair', 'poor', 'damaged'],
      required: false,
      default: 'good',
    },
    status: {
      type: 'enum',
      values: ['available', 'in_use', 'damaged', 'under_maintenance', 'retired'],
      required: false,
      default: 'available',
    },
    maintenance_interval_days: { type: 'int', required: false, min: 1 },
    notes: { type: 'string', required: false },
  });

  const result = await withTransaction(async (conn) => {
    const tempCode = `EQP-TMP-${Date.now()}`;
    const [ins] = await conn.query(
      `INSERT INTO equipment (equipment_code, name, category, brand, model, quantity, purchase_date, purchase_price, location, \`condition\`, status, maintenance_interval_days, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tempCode,
        data.name,
        data.category,
        data.brand || null,
        data.model || null,
        data.quantity,
        data.purchase_date || null,
        data.purchase_price || null,
        data.location || null,
        data.condition,
        data.status,
        data.maintenance_interval_days || null,
        data.notes || null,
      ]
    );

    const equipId = ins.insertId;
    const realCode = makeCode('EQP', equipId);
    await conn.query('UPDATE equipment SET equipment_code = ? WHERE id = ?', [realCode, equipId]);

    // Record initial purchase entry if price is specified
    if (data.purchase_price && data.purchase_date) {
      await conn.query(
        `INSERT INTO equipment_purchases (equipment_id, purchase_date, quantity, unit_cost, supplier, reference, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          equipId,
          data.purchase_date,
          data.quantity,
          data.purchase_price / data.quantity,
          data.brand || null,
          'Initial Purchase',
          req.user.id,
        ]
      );
    }

    return { equipId, realCode };
  });

  await logActivity(req, 'create', 'equipment', result.equipId, `Added equipment ${result.realCode} (${data.name})`);
  const created = await one('SELECT * FROM equipment WHERE id = ?', [result.equipId]);
  ok(res, created, 201);
}

export async function updateEquipment(req, res) {
  const id = parseId(req.params.id, 'equipment id');
  const existing = await one('SELECT * FROM equipment WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Equipment not found');

  const data = validate(
    req.body,
    {
      name: { type: 'string', required: true, maxLength: 120 },
      category: {
        type: 'enum',
        values: ['free_weights', 'cardio', 'strength_machine', 'functional', 'accessories', 'other'],
        required: true,
      },
      brand: { type: 'string', required: false, maxLength: 80 },
      model: { type: 'string', required: false, maxLength: 80 },
      quantity: { type: 'int', required: true, min: 1 },
      out_of_service_qty: { type: 'int', required: false, min: 0 },
      purchase_date: { type: 'date', required: false },
      purchase_price: { type: 'money', required: false },
      location: { type: 'string', required: false, maxLength: 120 },
      condition: {
        type: 'enum',
        values: ['excellent', 'good', 'fair', 'poor', 'damaged'],
        required: false,
      },
      status: {
        type: 'enum',
        values: ['available', 'in_use', 'damaged', 'under_maintenance', 'retired'],
        required: false,
      },
      maintenance_interval_days: { type: 'int', required: false, min: 1 },
      last_maintenance_date: { type: 'date', required: false },
      next_maintenance_date: { type: 'date', required: false },
      notes: { type: 'string', required: false },
    },
    { partial: true }
  );

  const qty = data.quantity ?? existing.quantity;
  const oos = data.out_of_service_qty ?? existing.out_of_service_qty;
  if (oos > qty) {
    throw ApiError.badRequest('Out-of-service quantity cannot exceed total quantity');
  }

  await q(
    `UPDATE equipment SET
       name = COALESCE(?, name),
       category = COALESCE(?, category),
       brand = ?,
       model = ?,
       quantity = COALESCE(?, quantity),
       out_of_service_qty = COALESCE(?, out_of_service_qty),
       purchase_date = ?,
       purchase_price = ?,
       location = ?,
       \`condition\` = COALESCE(?, \`condition\`),
       status = COALESCE(?, status),
       maintenance_interval_days = ?,
       last_maintenance_date = ?,
       next_maintenance_date = ?,
       notes = ?
     WHERE id = ?`,
    [
      data.name,
      data.category,
      data.brand !== undefined ? data.brand : existing.brand,
      data.model !== undefined ? data.model : existing.model,
      data.quantity,
      data.out_of_service_qty,
      data.purchase_date !== undefined ? data.purchase_date : existing.purchase_date,
      data.purchase_price !== undefined ? data.purchase_price : existing.purchase_price,
      data.location !== undefined ? data.location : existing.location,
      data.condition,
      data.status,
      data.maintenance_interval_days !== undefined ? data.maintenance_interval_days : existing.maintenance_interval_days,
      data.last_maintenance_date !== undefined ? data.last_maintenance_date : existing.last_maintenance_date,
      data.next_maintenance_date !== undefined ? data.next_maintenance_date : existing.next_maintenance_date,
      data.notes !== undefined ? data.notes : existing.notes,
      id,
    ]
  );

  await logActivity(req, 'update', 'equipment', id, `Updated equipment ${existing.equipment_code}`);
  const updated = await one('SELECT * FROM equipment WHERE id = ?', [id]);
  ok(res, updated);
}

export async function deleteEquipment(req, res) {
  const id = parseId(req.params.id, 'equipment id');
  const existing = await one('SELECT * FROM equipment WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Equipment not found');

  // Mark retired rather than hard deleting if records exist
  await q("UPDATE equipment SET status = 'retired' WHERE id = ?", [id]);
  await logActivity(req, 'retire', 'equipment', id, `Retired equipment ${existing.equipment_code}`);
  ok(res, { message: `Equipment ${existing.equipment_code} marked as retired` });
}

export async function getEquipmentStats(req, res) {
  const today = await gymToday();

  const [counts, conditionCounts, inventoryValuation] = await Promise.all([
    q(`SELECT status, COUNT(*) as count, SUM(quantity) as total_qty FROM equipment GROUP BY status`),
    q(`SELECT \`condition\`, COUNT(*) as count FROM equipment GROUP BY \`condition\``),
    one(`
      SELECT 
        SUM(COALESCE(purchase_price, 0)) as total_value,
        SUM(quantity) as total_units,
        COUNT(*) as total_models,
        SUM(CASE WHEN status IN ('damaged', 'under_maintenance') OR (next_maintenance_date IS NOT NULL AND next_maintenance_date <= '${today}') THEN 1 ELSE 0 END) as needs_maintenance_count
      FROM equipment
    `),
  ]);

  ok(res, {
    summary: inventoryValuation,
    byStatus: counts,
    byCondition: conditionCounts,
  });
}

