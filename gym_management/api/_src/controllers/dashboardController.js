import { q, one } from '../config/db.js';
import { ok } from '../utils/helpers.js';
import { gymToday, getSettings, refreshExpiredSubscriptions } from '../utils/settings.js';
import { localDateRangeUtc, startOfMonth, endOfMonth } from '../utils/dates.js';

export async function getDashboardData(req, res) {
  await refreshExpiredSubscriptions();
  const settings = await getSettings();
  const today = await gymToday();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [todayStartUtc, todayEndUtc] = localDateRangeUtc(today, today, settings.timezone);
  const [monthStartUtc, monthEndUtc] = localDateRangeUtc(monthStart, monthEnd, settings.timezone);

  // 1. Summary Cards (Requirement 4)
  const [
    totalMembersRow,
    activeMembersRow,
    expiredMembershipsRow,
    todayAttendanceRow,
    totalTrainersRow,
    totalEquipmentRow,
    equipmentMaintenanceRow,
    monthlyRevenueRow,
  ] = await Promise.all([
    one("SELECT COUNT(*) as count FROM members WHERE status != 'archived'"),
    one("SELECT COUNT(*) as count FROM members WHERE status = 'active'"),
    one("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'expired'"),
    one('SELECT COUNT(*) as count FROM attendance WHERE check_in >= ? AND check_in < ?', [todayStartUtc, todayEndUtc]),
    one("SELECT COUNT(*) as count FROM trainers WHERE status = 'active'"),
    one("SELECT COUNT(*) as count, SUM(quantity) as units FROM equipment WHERE status != 'retired'"),
    one(
      `SELECT COUNT(*) as count FROM equipment 
       WHERE status IN ('damaged', 'under_maintenance') 
          OR (next_maintenance_date IS NOT NULL AND next_maintenance_date <= ?)`,
      [today]
    ),
    one(
      `SELECT SUM(amount) as revenue 
       FROM payments 
       WHERE status = 'completed' AND payment_date >= ? AND payment_date < ?`,
      [monthStartUtc, monthEndUtc]
    ),
  ]);

  const cards = {
    total_members: Number(totalMembersRow?.count || 0),
    active_members: Number(activeMembersRow?.count || 0),
    expired_memberships: Number(expiredMembershipsRow?.count || 0),
    today_attendance: Number(todayAttendanceRow?.count || 0),
    total_trainers: Number(totalTrainersRow?.count || 0),
    total_equipment: Number(totalEquipmentRow?.count || 0),
    equipment_needing_maintenance: Number(equipmentMaintenanceRow?.count || 0),
    monthly_revenue: Number(monthlyRevenueRow?.revenue || 0),
  };

  // 2. Charts (Requirement 4)
  // Monthly Revenue (Past 6 months)
  const revenueTrend = await q(`
    SELECT DATE_FORMAT(payment_date, '%Y-%m') as month,
           SUM(amount) as revenue
    FROM payments
    WHERE status = 'completed' AND payment_date >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
    ORDER BY month ASC
  `);

  // Attendance Trends (Past 7 days)
  const attendanceTrend = await q(`
    SELECT DATE(check_in) as date,
           COUNT(*) as count
    FROM attendance
    WHERE check_in >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)
    GROUP BY DATE(check_in)
    ORDER BY date ASC
  `);

  // Membership Distribution (By active plan)
  const membershipDistribution = await q(`
    SELECT p.name, COUNT(s.id) as count
    FROM subscriptions s
    JOIN membership_plans p ON s.plan_id = p.id
    WHERE s.status = 'active'
    GROUP BY p.id, p.name
    ORDER BY count DESC
  `);

  // Equipment Condition distribution
  const equipmentCondition = await q(`
    SELECT \`condition\`, COUNT(*) as count
    FROM equipment
    WHERE status != 'retired'
    GROUP BY \`condition\`
  `);

  // 3. Recent Activity Tables (Requirement 4)
  const [recentMembers, recentPayments, latestAttendance, maintenanceAlerts] = await Promise.all([
    q(`
      SELECT id, member_code, first_name, last_name, email, registration_date, status 
      FROM members 
      WHERE status != 'archived'
      ORDER BY registration_date DESC, id DESC 
      LIMIT 5
    `),
    q(`
      SELECT p.id, p.receipt_no, p.amount, p.payment_date, p.method, p.status,
             m.member_code, m.first_name, m.last_name
      FROM payments p
      JOIN members m ON p.member_id = m.id
      ORDER BY p.payment_date DESC 
      LIMIT 5
    `),
    q(`
      SELECT a.id, a.check_in, a.check_out,
             m.member_code, m.first_name, m.last_name
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      ORDER BY a.check_in DESC 
      LIMIT 5
    `),
    q(`
      SELECT mr.id, mr.issue_description, mr.priority, mr.reported_date, mr.status,
             e.name as equipment_name, e.equipment_code
      FROM maintenance_records mr
      JOIN equipment e ON mr.equipment_id = e.id
      WHERE mr.status IN ('reported', 'scheduled', 'in_progress')
      ORDER BY CASE mr.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, mr.reported_date ASC
      LIMIT 5
    `),
  ]);

  ok(res, {
    cards,
    charts: {
      revenueTrend,
      attendanceTrend,
      membershipDistribution,
      equipmentCondition,
    },
    tables: {
      recentMembers,
      recentPayments,
      latestAttendance,
      maintenanceAlerts,
    },
    settings: {
      currency: settings.currency,
      timezone: settings.timezone,
      gym_name: settings.gym_name,
    },
  });
}

