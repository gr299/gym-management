import React, { useEffect, useState } from 'react';
import { Plus, UserCheck, Calendar, Clock, Edit, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export function Trainers() {
  const [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Trainer form modal
  const [trainerModalOpen, setTrainerModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [trainerForm, setTrainerForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    specialization: '',
    experience_years: 1,
    availability: '',
    status: 'active',
    bio: '',
  });

  // Schedule session modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    trainer_id: '',
    member_id: '',
    title: 'Personal Training Session',
    start_time: '',
    end_time: '',
    notes: '',
  });
  const [sessionConflictError, setSessionConflictError] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const { isAdmin, isStaff } = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const [tList, sList, mList] = await Promise.all([
        api.get('/trainers'),
        api.get('/training-sessions'),
        api.get('/members', { status: 'active', limit: 100 }),
      ]);
      setTrainers(tList);
      setSessions(sList);
      setMembers(mList.data);
    } catch (err) {
      console.error('Failed to load trainers data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateTrainer = () => {
    setEditingTrainer(null);
    setTrainerForm({
      full_name: '',
      email: '',
      phone: '',
      specialization: '',
      experience_years: 1,
      availability: 'Mon-Fri 08:00-16:00',
      status: 'active',
      bio: '',
    });
    setTrainerModalOpen(true);
  };

  const openEditTrainer = (t) => {
    setEditingTrainer(t);
    setTrainerForm({
      full_name: t.full_name,
      email: t.email,
      phone: t.phone || '',
      specialization: t.specialization || '',
      experience_years: t.experience_years,
      availability: t.availability || '',
      status: t.status,
      bio: t.bio || '',
    });
    setTrainerModalOpen(true);
  };

  const handleTrainerSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...trainerForm,
        experience_years: Number(trainerForm.experience_years),
      };

      if (editingTrainer) {
        await api.put(`/trainers/${editingTrainer.id}`, payload);
      } else {
        await api.post('/trainers', payload);
      }
      setTrainerModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Trainer operation failed');
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setSessionConflictError('');
    setScheduling(true);

    try {
      await api.post('/training-sessions', {
        trainer_id: Number(sessionForm.trainer_id),
        member_id: Number(sessionForm.member_id),
        title: sessionForm.title,
        start_time: sessionForm.start_time,
        end_time: sessionForm.end_time,
        notes: sessionForm.notes,
      });
      setSessionModalOpen(false);
      loadData();
    } catch (err) {
      setSessionConflictError(err.message || 'Scheduling conflict occurred');
    } finally {
      setScheduling(false);
    }
  };

  const handleSessionStatus = async (sessionId, status) => {
    try {
      await api.patch(`/training-sessions/${sessionId}/status`, { status });
      loadData();
    } catch (err) {
      alert(err.message || 'Status update failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trainer Management & Coaching</h1>
          <p className="page-subtitle">Schedule sessions, prevent conflicts, and oversee instructor loads</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setSessionModalOpen(true)}>
            <Calendar size={16} />
            <span>Book Training Session</span>
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreateTrainer}>
              <Plus size={16} />
              <span>Add Trainer</span>
            </button>
          )}
        </div>
      </div>

      {/* Trainers Cards */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 16 }}>Certified Fitness Trainers</h2>
        <div className="grid grid-cols-4">
          {trainers.map((t) => (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="badge badge-info">{t.trainer_code}</span>
                <span className={`badge badge-${t.status === 'active' ? 'success' : 'neutral'}`}>{t.status}</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 8 }}>{t.full_name}</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-orange)', fontWeight: 500, marginBottom: 6 }}>
                {t.specialization || 'General Fitness'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Experience: {t.experience_years} years | Availability: {t.availability || 'Flexible'}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: 16, flex: 1 }}>
                {t.bio || 'Dedicated fitness trainer.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {t.assigned_members_count} Members Assigned
                </span>
                {isAdmin && (
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditTrainer(t)}>
                    <Edit size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sessions Schedule Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="card-title">Training Sessions Schedule</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Trainer</th>
              <th>Member</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.title}</strong></td>
                <td>{s.trainer_name}</td>
                <td>{s.member_first_name} {s.member_last_name}</td>
                <td>{new Date(s.start_time).toLocaleString()}</td>
                <td>{new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                  <span
                    className={`badge badge-${
                      s.status === 'scheduled'
                        ? 'info'
                        : s.status === 'completed'
                        ? 'success'
                        : s.status === 'cancelled'
                        ? 'neutral'
                        : 'danger'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {s.status === 'scheduled' && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSessionStatus(s.id, 'completed')}
                      >
                        Complete
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSessionStatus(s.id, 'cancelled')}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No training sessions scheduled.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Trainer Modal */}
      <Modal
        isOpen={trainerModalOpen}
        onClose={() => setTrainerModalOpen(false)}
        title={editingTrainer ? `Edit Trainer: ${editingTrainer.full_name}` : 'Add New Trainer'}
      >
        <form onSubmit={handleTrainerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              value={trainerForm.full_name}
              onChange={(e) => setTrainerForm({ ...trainerForm, full_name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Email *</label>
              <input
                type="email"
                className="form-input"
                value={trainerForm.email}
                onChange={(e) => setTrainerForm({ ...trainerForm, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input
                type="text"
                className="form-input"
                value={trainerForm.phone}
                onChange={(e) => setTrainerForm({ ...trainerForm, phone: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Specialization</label>
              <input
                type="text"
                className="form-input"
                value={trainerForm.specialization}
                onChange={(e) => setTrainerForm({ ...trainerForm, specialization: e.target.value })}
                placeholder="Strength, Mobility, HIIT..."
              />
            </div>
            <div>
              <label className="form-label">Years Exp.</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={trainerForm.experience_years}
                onChange={(e) => setTrainerForm({ ...trainerForm, experience_years: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Availability Schedule</label>
            <input
              type="text"
              className="form-input"
              value={trainerForm.availability}
              onChange={(e) => setTrainerForm({ ...trainerForm, availability: e.target.value })}
              placeholder="e.g. Mon-Fri 06:00-14:00"
            />
          </div>

          <div>
            <label className="form-label">Biography & Credentials</label>
            <textarea
              className="form-input"
              rows={2}
              value={trainerForm.bio}
              onChange={(e) => setTrainerForm({ ...trainerForm, bio: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setTrainerModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Trainer</button>
          </div>
        </form>
      </Modal>

      {/* Book Session Modal */}
      <Modal
        isOpen={sessionModalOpen}
        onClose={() => {
          setSessionModalOpen(false);
          setSessionConflictError('');
        }}
        title="Schedule Training Session"
      >
        <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sessionConflictError && (
            <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 6, display: 'flex', gap: 8 }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div><strong>Booking Conflict:</strong> {sessionConflictError}</div>
            </div>
          )}

          <div>
            <label className="form-label">Trainer *</label>
            <select
              className="form-input"
              value={sessionForm.trainer_id}
              onChange={(e) => setSessionForm({ ...sessionForm, trainer_id: e.target.value })}
              required
            >
              <option value="">-- Select Trainer --</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name} ({t.specialization || 'General'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Member *</label>
            <select
              className="form-input"
              value={sessionForm.member_id}
              onChange={(e) => setSessionForm({ ...sessionForm, member_id: e.target.value })}
              required
            >
              <option value="">-- Select Member --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.member_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Session Title</label>
            <input
              type="text"
              className="form-input"
              value={sessionForm.title}
              onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Start Date & Time *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={sessionForm.start_time}
                onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">End Date & Time *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={sessionForm.end_time}
                onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">Notes for Session</label>
            <input
              type="text"
              className="form-input"
              value={sessionForm.notes}
              onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSessionModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={scheduling}>
              {scheduling ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

