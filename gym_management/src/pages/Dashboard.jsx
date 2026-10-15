import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  CreditCard,
  CalendarCheck,
  DollarSign,
  Package,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';

const PIE_COLORS = ['#ff6b00', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await api.get('/dashboard');
        setData(res);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading live dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 30, textAlign: 'center', borderColor: 'var(--status-danger)' }}>
        <AlertTriangle size={36} color="var(--status-danger)" style={{ margin: '0 auto 12px' }} />
        <h3>Failed to load dashboard</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>{error}</p>
      </div>
    );
  }

  const { cards, charts, tables, settings } = data || {};
  const currency = settings?.currency || 'PHP';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-subtitle">Real-time statistics for {settings?.gym_name || 'Gym'}</p>
        </div>
      </div>

      {/* 8 Summary Cards (Requirement 4) */}
      <div className="grid grid-cols-4" style={{ marginBottom: 24 }}>
        <StatCard
          title="Total Members"
          value={cards?.total_members}
          icon={Users}
          color="#3b82f6"
          subtext="Registered accounts"
        />
        <StatCard
          title="Active Members"
          value={cards?.active_members}
          icon={UserCheck}
          color="#10b981"
          subtext="Currently enrolled"
        />
        <StatCard
          title="Expired Memberships"
          value={cards?.expired_memberships}
          icon={CreditCard}
          color="#ef4444"
          subtext="Needs renewal"
        />
        <StatCard
          title="Today's Attendance"
          value={cards?.today_attendance}
          icon={CalendarCheck}
          color="#ff6b00"
          subtext="Total check-ins today"
        />
        <StatCard
          title="Total Trainers"
          value={cards?.total_trainers}
          icon={UserCheck}
          color="#8b5cf6"
          subtext="Active coaches"
        />
        <StatCard
          title="Total Equipment"
          value={cards?.total_equipment}
          icon={Package}
          color="#06b6d4"
          subtext="Tracked models/machines"
        />
        <StatCard
          title="Maintenance Needed"
          value={cards?.equipment_needing_maintenance}
          icon={Wrench}
          color="#f59e0b"
          subtext="Overdue or repair needed"
        />
        <StatCard
          title="Monthly Revenue"
          value={`${currency} ${(cards?.monthly_revenue || 0).toLocaleString()}`}
          icon={DollarSign}
          color="#10b981"
          subtext="Current calendar month"
        />
      </div>

      {/* 4 Interactive Charts (Requirement 4) */}
      <div className="grid grid-cols-2" style={{ marginBottom: 24 }}>
        {/* Revenue Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Monthly Revenue Trend</h3>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={charts?.revenueTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  formatter={(val) => [`${currency} ${Number(val).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#171922', borderColor: '#2b3040', color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#ff6b00" fill="#ff6b0033" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Attendance Trends (Last 7 Days)</h3>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={charts?.attendanceTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  formatter={(val) => [val, 'Check-ins']}
                  contentStyle={{ backgroundColor: '#171922', borderColor: '#2b3040', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Membership Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Active Memberships Distribution</h3>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={charts?.membershipDistribution || []}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {(charts?.membershipDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#171922', borderColor: '#2b3040', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Equipment Condition */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Equipment Condition Overview</h3>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={charts?.equipmentCondition || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="condition" type="category" stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#171922', borderColor: '#2b3040', color: '#fff' }} />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4 Recent Activity Tables (Requirement 4) */}
      <div className="grid grid-cols-2">
        {/* Recently Registered Members */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recently Registered Members</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Registered</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tables?.recentMembers?.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.member_code}</strong></td>
                  <td>{m.first_name} {m.last_name}</td>
                  <td>{m.registration_date}</td>
                  <td>
                    <span className={`badge badge-${m.status === 'active' ? 'success' : 'neutral'}`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Payments */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Payment Transactions</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Member</th>
                <th>Amount</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {tables?.recentPayments?.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.receipt_no}</strong></td>
                  <td>{p.first_name} {p.last_name}</td>
                  <td>{currency} {Number(p.amount).toLocaleString()}</td>
                  <td><span className="badge badge-info">{p.method?.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Latest Attendance */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Latest Check-ins</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Check In</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tables?.latestAttendance?.map((a) => (
                <tr key={a.id}>
                  <td>{a.first_name} {a.last_name} ({a.member_code})</td>
                  <td>{new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className={`badge badge-${a.check_out ? 'neutral' : 'success'}`}>
                      {a.check_out ? 'Checked Out' : 'Active Inside'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Equipment Maintenance Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Equipment Maintenance Alerts</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Issue</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tables?.maintenanceAlerts?.map((mr) => (
                <tr key={mr.id}>
                  <td>{mr.equipment_name}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mr.issue_description}
                  </td>
                  <td>
                    <span className={`badge badge-${mr.priority === 'high' || mr.priority === 'critical' ? 'danger' : 'warning'}`}>
                      {mr.priority}
                    </span>
                  </td>
                  <td><span className="badge badge-neutral">{mr.status}</span></td>
                </tr>
              ))}
              {(!tables?.maintenanceAlerts || tables.maintenanceAlerts.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No pending maintenance alerts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

