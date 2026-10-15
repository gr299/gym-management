import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  CreditCard,
  Calendar,
  Clock,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export function MemberDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isStaff } = useAuth();

  const [member, setMember] = useState(null);
  const [history, setHistory] = useState({ subscriptions: [], payments: [], attendance: [] });
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Subscription modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [subStartDate, setSubStartDate] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);

  // Record Payment modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [paySubId, setPaySubId] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [m, h, p] = await Promise.all([
        api.get(`/members/${id}`),
        api.get(`/members/${id}/history`),
        api.get('/membership-plans', { status: 'active' }),
      ]);
      setMember(m);
      setHistory(h);
      setPlans(p);
      if (p.length > 0) setSelectedPlanId(p[0].id);
    } catch (err) {
      console.error('Failed to load member profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    setSubSubmitting(true);
    try {
      await api.post('/subscriptions', {
        member_id: Number(id),
        plan_id: Number(selectedPlanId),
        start_date: subStartDate || undefined,
        notes: subNotes,
      });
      setSubModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to assign plan');
    } finally {
      setSubSubmitting(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setPaySubmitting(true);
    try {
      await api.post('/payments', {
        member_id: Number(id),
        subscription_id: paySubId ? Number(paySubId) : undefined,
        amount: Number(payAmount),
        method: payMethod,
        reference: payRef,
        description: 'Membership payment',
        status: 'completed',
        idempotency_key: `pay-${id}-${Date.now()}`,
      });
      setPayModalOpen(false);
      setPayAmount('');
      setPayRef('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading member profile...</div>;
  }

  if (!member) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Member not found.</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/members')}>
            <ArrowLeft size={16} />
            <span>Back to Members</span>
          </button>
          <h1 className="page-title">{member.first_name} {member.last_name}</h1>
          <span className={`badge badge-${member.status === 'active' ? 'success' : 'neutral'}`}>
            {member.status}
          </span>
        </div>

        {isStaff && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setSubModalOpen(true)}>
              <CreditCard size={16} />
              <span>Assign Plan</span>
            </button>
            <button className="btn btn-primary" onClick={() => setPayModalOpen(true)}>
              <Plus size={16} />
              <span>Record Payment</span>
            </button>
          </div>
        )}
      </div>

      {/* Profile Overview Card */}
      <div className="grid grid-cols-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Member Details</h3>
            <strong>{member.member_code}</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Email:</span>
              <div style={{ fontWeight: 500 }}>{member.email}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
              <div style={{ fontWeight: 500 }}>{member.phone || 'N/A'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Registered:</span>
              <div style={{ fontWeight: 500 }}>{member.registration_date}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Assigned Trainer:</span>
              <div style={{ fontWeight: 500 }}>{member.trainer_name || 'None'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Address:</span>
              <div style={{ fontWeight: 500 }}>{member.address || 'N/A'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Emergency Contact:</span>
              <div style={{ fontWeight: 500 }}>
                {member.emergency_contact_name || 'N/A'}{' '}
                {member.emergency_contact_phone && `(${member.emergency_contact_phone})`}
              </div>
            </div>
          </div>
        </div>

        {/* Current Active Subscription */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Current Membership Plan</h3>
          </div>
          {member.currentSubscription ? (
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-orange)' }}>
                {member.currentSubscription.plan_name}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: '0.88rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Start: </span>
                  <strong>{member.currentSubscription.start_date}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Expires: </span>
                  <strong>{member.currentSubscription.end_date}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <span className={`badge badge-${member.currentSubscription.status === 'active' ? 'success' : 'danger'}`}>
                  Subscription: {member.currentSubscription.status}
                </span>
                <span className={`badge badge-${member.currentSubscription.payment_status === 'paid' ? 'success' : 'warning'}`}>
                  Payment: {member.currentSubscription.payment_status}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No active subscription. Click "Assign Plan" above to activate.</p>
          )}
        </div>
      </div>

      {/* Tabs / History Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Subscriptions History</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Period</th>
              <th>Price</th>
              <th>Status</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {history.subscriptions.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.plan_name}</strong></td>
                <td>{s.start_date} to {s.end_date}</td>
                <td>PHP {Number(s.price).toLocaleString()}</td>
                <td><span className={`badge badge-${s.status === 'active' ? 'success' : 'neutral'}`}>{s.status}</span></td>
                <td><span className={`badge badge-${s.payment_status === 'paid' ? 'success' : 'warning'}`}>{s.payment_status}</span></td>
              </tr>
            ))}
            {history.subscriptions.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No subscriptions on record.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2">
        {/* Payment History */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Payment History</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.payments.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.receipt_no}</strong></td>
                  <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td>PHP {Number(p.amount).toLocaleString()}</td>
                  <td>{p.method}</td>
                  <td><span className={`badge badge-${p.status === 'completed' ? 'success' : 'neutral'}`}>{p.status}</span></td>
                </tr>
              ))}
              {history.payments.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No payments on record.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Attendance History */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Attendance</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {history.attendance.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.check_in).toLocaleString()}</td>
                  <td>{a.check_out ? new Date(a.check_out).toLocaleString() : <span className="badge badge-success">Inside</span>}</td>
                  <td>{a.recorded_by_name || 'Staff'}</td>
                </tr>
              ))}
              {history.attendance.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No attendance history.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Plan Modal */}
      <Modal isOpen={subModalOpen} onClose={() => setSubModalOpen(false)} title="Assign Membership Plan">
        <form onSubmit={handleCreateSubscription} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Select Plan *</label>
            <select
              className="form-input"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              required
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — PHP {Number(p.price).toLocaleString()} ({p.duration_value} {p.duration_unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Start Date (Optional, defaults to today)</label>
            <input
              type="date"
              className="form-input"
              value={subStartDate}
              onChange={(e) => setSubStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              rows={2}
              value={subNotes}
              onChange={(e) => setSubNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSubModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={subSubmitting}>
              {subSubmitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal isOpen={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record Member Payment">
        <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Payment Amount (PHP) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="form-input"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label">Payment Method *</label>
            <select
              className="form-input"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="e_wallet">E-Wallet (GCash / Maya)</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Credit / Debit Card</option>
            </select>
          </div>

          <div>
            <label className="form-label">Reference Number (optional for cash)</label>
            <input
              type="text"
              className="form-input"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g. GCASH-123456"
            />
          </div>

          {history.subscriptions.length > 0 && (
            <div>
              <label className="form-label">Apply to Subscription</label>
              <select
                className="form-input"
                value={paySubId}
                onChange={(e) => setPaySubId(e.target.value)}
              >
                <option value="">-- General / Other Fee --</option>
                {history.subscriptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} {s.plan_name} ({s.payment_status}) — PHP {s.price}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPayModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={paySubmitting}>
              {paySubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

