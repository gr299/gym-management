import { q, one } from '../config/db.js';
import { ok } from '../utils/helpers.js';
import { getSettings } from '../utils/settings.js';
import { buildWhere } from '../utils/query.js';

function toCsv(rows) {
  if (!rows || !rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) {
    const vals = headers.map((h) => {
      let val = r[h] == null ? '' : String(r[h]);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

export async function getReports(req, res) {
  const { type, from_date, to_date, format } = req.query;
  const settings = await getSettings();

  let data = [];
  let title = 'Report';

  switch (type) {
    case 'members': {
      title = 'Member Registration Report';
      const { where, params } = buildWhere([
        from_date ? ['m.registration_date >= ?', from_date] : null,
        to_date ? ['m.registration_date <= ?', to_date] : null,
      ]);
      data = await q(
        `SELECT m.member_code, m.first_name, m.last_name, m.email, m.phone, m.registration_date, m.status,
                t.full_name as assigned_trainer
         FROM members m
         LEFT JOIN trainers t ON m.trainer_id = t.id
         ${where}
         ORDER BY m.registration_date DESC`,
        params
      );
      break;
    }

    case 'subscriptions': {
      title = 'Subscriptions and Membership Status Report';
      const { where, params } = buildWhere([
        from_date ? ['s.start_date >= ?', from_date] : null,
        to_date ? ['s.start_date <= ?', to_date] : null,
      ]);
      data = await q(
        `SELECT s.id, m.member_code, CONCAT(m.first_name, ' ', m.last_name) as member_name,
                p.name as plan_name, s.start_date, s.end_date, s.price, s.status, s.payment_status
         FROM subscriptions s
         JOIN members m ON s.member_id = m.id
         JOIN membership_plans p ON s.plan_id = p.id
         ${where}
         ORDER BY s.start_date DESC`,
        params
      );
      break;
    }

    case 'attendance': {
      title = 'Attendance Report';
      const { where, params } = buildWhere([
        from_date ? ['DATE(a.check_in) >= ?', from_date] : null,
        to_date ? ['DATE(a.check_in) <= ?', to_date] : null,
      ]);
      data = await q(
        `SELECT a.id, m.member_code, CONCAT(m.first_name, ' ', m.last_name) as member_name,
                a.check_in, a.check_out, a.notes
         FROM attendance a
         JOIN members m ON a.member_id = m.id
         ${where}
         ORDER BY a.check_in DESC`,
        params
      );
      break;
    }

    case 'payments': {
      title = 'Payment Transactions Report';
      const { where, params } = buildWhere([
        from_date ? ['DATE(p.payment_date) >= ?', from_date] : null,
        to_date ? ['DATE(p.payment_date) <= ?', to_date] : null,
      ]);
      data = await q(
        `SELECT p.receipt_no, m.member_code, CONCAT(m.first_name, ' ', m.last_name) as member_name,
                p.amount, p.payment_date, p.method, p.reference, p.status, p.description
         FROM payments p
         JOIN members m ON p.member_id = m.id
         ${where}
         ORDER BY p.payment_date DESC`,
        params
      );
      break;
    }

    case 'revenue': {
      title = 'Monthly Revenue Summary';
      const { where, params } = buildWhere([
        ["status = 'completed'"],
        from_date ? ['DATE(payment_date) >= ?', from_date] : null,
        to_date ? ['DATE(payment_date) <= ?', to_date] : null,
      ]);
      data = await q(
        `SELECT DATE_FORMAT(payment_date, '%Y-%m') as month,
                COUNT(id) as transaction_count,
                SUM(amount) as total_revenue
         FROM payments
         ${where}
         GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
         ORDER BY month DESC`,
        params
      );
      break;
    }

    case 'equipment':
      title = 'Equipment Inventory and Maintenance Report';
      data = await q(
        `SELECT equipment_code, name, category, brand, quantity, out_of_service_qty,
                \`condition\`, status, purchase_price, last_maintenance_date, next_maintenance_date
         FROM equipment
         WHERE status != 'retired'
         ORDER BY name ASC`
      );
      break;

    case 'maintenance': {
      title = 'Maintenance History and Expenses';
      const { where, params } = buildWhere([
        from_date ? ['mr.reported_date >= ?', from_date] : null,
        to_date ? ['mr.reported_date <= ?', to_date] : null,
      ]);
      data = await q(
        `SELECT mr.id, e.equipment_code, e.name as equipment_name, mr.issue_description,
                mr.maintenance_type, mr.priority, mr.reported_date, mr.completed_date,
                mr.technician, mr.cost, mr.status
         FROM maintenance_records mr
         JOIN equipment e ON mr.equipment_id = e.id
         ${where}
         ORDER BY mr.reported_date DESC`,
        params
      );
      break;
    }

    default:
      data = await q(`SELECT 'Please specify a valid report type' as notice`);
  }

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type || 'report'}.csv"`);
    return res.send(toCsv(data));
  }

  ok(res, {
    title,
    type,
    currency: settings.currency,
    timezone: settings.timezone,
    data,
  });
}

