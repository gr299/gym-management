import React, { useEffect, useState } from 'react';
import { Plus, Edit, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export function Memberships() {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit plan modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    duration_value: 1,
    duration_unit: 'month',
    price: '',
    status: 'active',
  });

  const { isAdmin } = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.get('/membership-plans'),
        api.get('/subscriptions'),
      ]);
      setPlans(p);
      setSubscriptions(s);
    } catch (err) {
      console.error('Failed to load memberships data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      description: '',
      duration_value: 1,
      duration_unit: 'month',
      price: '',
      status: 'active',
    });
    setPlanModalOpen(true);
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      duration_value: plan.duration_value,
      duration_unit: plan.duration_unit,
      price: plan.price,
      status: plan.status,
    });
    setPlanModalOpen(true);
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...planForm,
        duration_value: Number(planForm.duration_value),
        price: Number(planForm.price),
      };

      if (editingPlan) {
        await api.put(`/membership-plans/${editingPlan.id}`, payload);
      } else {
        await api.post('/membership-plans', payload);
      }
      setPlanModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleRenew = async (subId) => {
    if (!window.confirm('Renew this membership subscription?')) return;
    try {
      await api.post(`/subscriptions/${subId}/renew`);
      loadData();
    } catch (err) {
      alert(err.message || 'Renewal failed');
    }
  };

  const handleCancel = async (subId) => {
    if (!window.confirm('Are you sure you want to cancel this subscription?')) return;
    try {
      await api.post(`/subscriptions/${subId}/cancel`);
      loadData();
    } catch (err) {
      alert(err.message || 'Cancellation failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Membership Management</h1>
          <p className="page-subtitle">Configure pricing plans and oversee active subscriber cycles</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreatePlan}>
            <Plus size={16} />
            <span>Create Membership Plan</span>
          </button>
        )}
      </div>

      {/* Plans Section */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 16 }}>Available Membership Plans</h2>
        <div className="grid grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{p.name}</h3>
                <span className={`badge badge-${p.status === 'active' ? 'success' : 'neutral'}`}>
                  {p.status}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '8px 0 16px', flex: 1 }}>
                {p.description || 'General gym access.'}
              </p>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-orange)', marginBottom: 4 }}>
                PHP {Number(p.price).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Duration: {p.duration_value} {p.duration_unit}(s)
              </div>
              {isAdmin && (
                <button className="btn btn-secondary btn-sm" onClick={() => openEditPlan(p)}>
                  <Edit size={14} />
                  <span>Edit Plan</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active & Expired Subscriptions Section */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="card-title">Member Subscriptions Tracker</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan</th>
              <th>Start Date</th>
              <th>Expiration Date</th>
              <th>Status</th>
              <th>Payment</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.first_name} {s.last_name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.member_code}</div>
                </td>
                <td>{s.plan_name}</td>
                <td>{s.start_date}</td>
                <td>
                  <strong>{s.end_date}</strong>
                </td>
                <td>
                  <span
                    className={`badge badge-${
                      s.status === 'active' ? 'success' : s.status === 'expired' ? 'danger' : 'neutral'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${s.payment_status === 'paid' ? 'success' : 'warning'}`}>
                    {s.payment_status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      title="Renew Subscription"
                      onClick={() => handleRenew(s.id)}
                    >
                      <RefreshCw size={13} />
                      <span>Renew</span>
                    </button>
                    {s.status === 'active' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        title="Cancel Subscription"
                        onClick={() => handleCancel(s.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Plan Modal */}
      <Modal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title={editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Membership Plan'}
      >
        <form onSubmit={handlePlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Plan Name *</label>
            <input
              type="text"
              className="form-input"
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows={2}
              value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Duration Value *</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={planForm.duration_value}
                onChange={(e) => setPlanForm({ ...planForm, duration_value: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Duration Unit *</label>
              <select
                className="form-input"
                value={planForm.duration_unit}
                onChange={(e) => setPlanForm({ ...planForm, duration_unit: e.target.value })}
              >
                <option value="day">Day(s)</option>
                <option value="week">Week(s)</option>
                <option value="month">Month(s)</option>
                <option value="year">Year(s)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Price (PHP) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={planForm.price}
                onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={planForm.status}
                onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPlanModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

