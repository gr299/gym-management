import React, { useEffect, useState } from 'react';
import { Save, UserPlus, Shield, UserCheck, Lock } from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const [gymSettings, setGymSettings] = useState({
    gym_name: '',
    address: '',
    phone: '',
    email: '',
    currency: 'PHP',
    timezone: 'Asia/Manila',
    grace_period_days: 3,
    checkin_requires_payment: true,
    expiring_soon_days: 7,
    default_session_minutes: 60,
    receipt_footer: '',
  });

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // User creation modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [userModalError, setUserModalError] = useState('');

  const { user, isAdmin } = useAuth();

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        api.get('/settings'),
        isAdmin ? api.get('/users') : Promise.resolve([]),
      ]);
      setGymSettings(s);
      setUsers(u);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setSaveSuccess('');
    try {
      await api.put('/settings', {
        ...gymSettings,
        grace_period_days: Number(gymSettings.grace_period_days),
        expiring_soon_days: Number(gymSettings.expiring_soon_days),
        default_session_minutes: Number(gymSettings.default_session_minutes),
      });
      setSaveSuccess('Gym configuration updated successfully!');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to save settings');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPassError('New passwords do not match');
      return;
    }

    try {
      await api.put('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPassSuccess('Password updated successfully!');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setPassSuccess(''), 4000);
    } catch (err) {
      setPassError(err.message || 'Failed to change password');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserModalError('');
    try {
      await api.post('/users', userForm);
      setUserModalOpen(false);
      setUserForm({ full_name: '', email: '', password: '', role: 'staff' });
      loadSettingsData();
    } catch (err) {
      setUserModalError(err.message || 'Failed to create user account');
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading gym settings...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings & Accounts</h1>
          <p className="page-subtitle">Configure gym profile, regional currency, business rules, and manage user access</p>
        </div>
      </div>

      <div className="grid grid-cols-2" style={{ marginBottom: 24 }}>
        {/* Gym Information & Configuration */}
        {isAdmin && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Gym Profile & Business Rules</h3>
            </div>

            {saveSuccess && (
              <div style={{ padding: 10, background: '#d1fae5', color: '#065f46', borderRadius: 6, marginBottom: 14 }}>
                {saveSuccess}
              </div>
            )}

            <form onSubmit={handleSettingsSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Gym Facility Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={gymSettings.gym_name}
                  onChange={(e) => setGymSettings({ ...gymSettings, gym_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={gymSettings.address || ''}
                  onChange={(e) => setGymSettings({ ...gymSettings, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={gymSettings.phone || ''}
                    onChange={(e) => setGymSettings({ ...gymSettings, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={gymSettings.email || ''}
                    onChange={(e) => setGymSettings({ ...gymSettings, email: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Currency Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={gymSettings.currency}
                    onChange={(e) => setGymSettings({ ...gymSettings, currency: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Local Timezone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={gymSettings.timezone}
                    onChange={(e) => setGymSettings({ ...gymSettings, timezone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Grace Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={gymSettings.grace_period_days}
                    onChange={(e) => setGymSettings({ ...gymSettings, grace_period_days: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Expiring Soon Threshold (Days)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={gymSettings.expiring_soon_days}
                    onChange={(e) => setGymSettings({ ...gymSettings, expiring_soon_days: e.target.value })}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(gymSettings.checkin_requires_payment)}
                  onChange={(e) => setGymSettings({ ...gymSettings, checkin_requires_payment: e.target.checked })}
                />
                Require paid subscription for member check-in
              </label>

              <div>
                <label className="form-label">Receipt Footer Message</label>
                <input
                  type="text"
                  className="form-input"
                  value={gymSettings.receipt_footer || ''}
                  onChange={(e) => setGymSettings({ ...gymSettings, receipt_footer: e.target.value })}
                  placeholder="Thank you for training with us!"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                <Save size={16} />
                <span>Save Configuration</span>
              </button>
            </form>
          </div>
        )}

        {/* Change Personal Password */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Security & Change Password</h3>
          </div>

          {passSuccess && (
            <div style={{ padding: 10, background: '#d1fae5', color: '#065f46', borderRadius: 6, marginBottom: 14 }}>
              {passSuccess}
            </div>
          )}
          {passError && (
            <div style={{ padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 14 }}>
              {passError}
            </div>
          )}

          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Current Password *</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">New Password * (Min 8 chars, 1 letter, 1 number)</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">Confirm New Password *</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <Lock size={16} />
              <span>Update Password</span>
            </button>
          </form>
        </div>
      </div>

      {/* User Management (Admin Only) */}
      {isAdmin && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Authorized Staff & Admin Accounts</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setUserModalOpen(true)}>
              <UserPlus size={14} />
              <span>Create Account</span>
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.full_name}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge badge-${u.role === 'admin' ? 'info' : 'neutral'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${u.is_active ? 'success' : 'danger'}`}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title="Create New System User"
      >
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {userModalError && (
            <div style={{ padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: '0.85rem' }}>
              {userModalError}
            </div>
          )}

          <div>
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="form-input"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label">Password * (Min 8 chars, 1 letter, 1 number)</label>
            <input
              type="password"
              className="form-input"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label">Assigned Role *</label>
            <select
              className="form-input"
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
            >
              <option value="staff">Staff (Front Desk)</option>
              <option value="trainer">Trainer</option>
              <option value="admin">Administrator (Full Access)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setUserModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Account</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

