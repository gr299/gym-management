import React, { useEffect, useState } from 'react';
import { Plus, Dumbbell, Calendar, CheckCircle2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export function WorkoutPlans() {
  const [plans, setPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);

  // View details modal
  const [activePlan, setActivePlan] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Create plan modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    member_id: '',
    trainer_id: '',
    goal: '',
    schedule: '',
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [exercises, setExercises] = useState([
    { day_label: 'Day 1', exercise_name: 'Barbell Bench Press', sets: 4, reps: '8-10', weight: '60 kg', rest_seconds: 90, notes: '' },
    { day_label: 'Day 1', exercise_name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', weight: '22 kg', rest_seconds: 60, notes: '' },
  ]);
  const [creating, setCreating] = useState(false);

  const { user, isTrainer, isAdmin } = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const [pList, mList, tList] = await Promise.all([
        api.get('/workout-plans'),
        api.get('/members', { status: 'active', limit: 100 }),
        api.get('/trainers', { status: 'active' }),
      ]);
      setPlans(pList);
      setMembers(mList.data);
      setTrainers(tList);
    } catch (err) {
      console.error('Failed to load workout plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openPlanDetails = async (planId) => {
    try {
      const detailed = await api.get(`/workout-plans/${planId}`);
      setActivePlan(detailed);
      setDetailsModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to load plan details');
    }
  };

  const addExerciseRow = () => {
    setExercises([
      ...exercises,
      { day_label: 'Day 1', exercise_name: '', sets: 3, reps: '10', weight: '', rest_seconds: 60, notes: '' },
    ]);
  };

  const removeExerciseRow = (index) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const updateExerciseRow = (index, field, value) => {
    const updated = [...exercises];
    updated[index][field] = value;
    setExercises(updated);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      await api.post('/workout-plans', {
        ...planForm,
        member_id: Number(planForm.member_id),
        trainer_id: planForm.trainer_id ? Number(planForm.trainer_id) : undefined,
        exercises,
      });
      setCreateModalOpen(false);
      setPlanForm({
        name: '',
        member_id: '',
        trainer_id: '',
        goal: '',
        schedule: '',
        start_date: '',
        end_date: '',
        notes: '',
      });
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  const handleLogWorkout = async (planId) => {
    try {
      await api.post(`/workout-plans/${planId}/complete`, {});
      alert('Workout session logged as completed today!');
      openPlanDetails(planId);
    } catch (err) {
      alert(err.message || 'Failed to log workout');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Workout Plans & Routines</h1>
          <p className="page-subtitle">Personalized member regimens, exercise lists, and session tracking</p>
        </div>
        {(isAdmin || isTrainer) && (
          <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            <span>Create Workout Plan</span>
          </button>
        )}
      </div>

      {/* Grid of Workout Plans */}
      <div className="grid grid-cols-2" style={{ marginBottom: 24 }}>
        {plans.map((p) => (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{p.name}</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Member: <strong>{p.member_first_name} {p.member_last_name}</strong> ({p.member_code})
                </div>
              </div>
              <span className={`badge badge-${p.status === 'active' ? 'success' : 'neutral'}`}>
                {p.status}
              </span>
            </div>

            <div style={{ margin: '12px 0', fontSize: '0.88rem', flex: 1 }}>
              <div><strong>Goal:</strong> {p.goal || 'General Fitness'}</div>
              <div><strong>Schedule:</strong> {p.schedule || 'Flexible'}</div>
              <div><strong>Trainer:</strong> {p.trainer_name || 'Self-guided'}</div>
              <div style={{ marginTop: 6, color: 'var(--color-orange)', fontWeight: 600 }}>
                {p.total_exercises} Exercises Included
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => openPlanDetails(p.id)}>
                View Routine & Exercises
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => handleLogWorkout(p.id)}>
                <CheckCircle2 size={14} />
                <span>Log Completed Session</span>
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="card" style={{ gridColumn: 'span 2', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No workout plans found. Click "Create Workout Plan" to prescribe a routine.
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={activePlan ? `Workout Plan: ${activePlan.name}` : ''}
        maxWidth={700}
      >
        {activePlan && (
          <div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: '0.9rem' }}>
              <div><strong>Member:</strong> {activePlan.member_first_name} {activePlan.member_last_name}</div>
              <div><strong>Trainer:</strong> {activePlan.trainer_name || 'Self'}</div>
              <div><strong>Goal:</strong> {activePlan.goal}</div>
            </div>

            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 10 }}>Prescribed Exercises</h4>
            <table className="data-table" style={{ marginBottom: 20 }}>
              <thead>
                <tr>
                  <th>Split / Day</th>
                  <th>Exercise</th>
                  <th>Sets</th>
                  <th>Reps</th>
                  <th>Target Weight</th>
                  <th>Rest</th>
                </tr>
              </thead>
              <tbody>
                {activePlan.exercises?.map((ex) => (
                  <tr key={ex.id}>
                    <td><span className="badge badge-info">{ex.day_label || 'Any'}</span></td>
                    <td><strong>{ex.exercise_name}</strong></td>
                    <td>{ex.sets}</td>
                    <td>{ex.reps}</td>
                    <td>{ex.weight || '—'}</td>
                    <td>{ex.rest_seconds ? `${ex.rest_seconds}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {activePlan.logs?.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Recent Completion History</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {activePlan.logs.map((l) => (
                    <span key={l.id} className="badge badge-success" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                      Completed on {l.completed_on}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Workout Plan Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Member Workout Plan"
        maxWidth={750}
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Plan Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 4-Day Hypertrophy Split"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Member *</label>
              <select
                className="form-input"
                value={planForm.member_id}
                onChange={(e) => setPlanForm({ ...planForm, member_id: e.target.value })}
                required
              >
                <option value="">-- Select Member --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Fitness Goal</label>
              <input
                type="text"
                className="form-input"
                placeholder="Strength, fat loss, stamina..."
                value={planForm.goal}
                onChange={(e) => setPlanForm({ ...planForm, goal: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Schedule Split</label>
              <input
                type="text"
                className="form-input"
                placeholder="Mon/Wed/Fri"
                value={planForm.schedule}
                onChange={(e) => setPlanForm({ ...planForm, schedule: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Trainer</label>
              <select
                className="form-input"
                value={planForm.trainer_id}
                onChange={(e) => setPlanForm({ ...planForm, trainer_id: e.target.value })}
              >
                <option value="">-- None / Self --</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Exercise Movements</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addExerciseRow}>
                <Plus size={14} />
                <span>Add Exercise</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {exercises.map((ex, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: 100 }}
                    placeholder="Day / Split"
                    value={ex.day_label}
                    onChange={(e) => updateExerciseRow(i, 'day_label', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 2 }}
                    placeholder="Exercise name (e.g. Squat)"
                    value={ex.exercise_name}
                    onChange={(e) => updateExerciseRow(i, 'exercise_name', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 65 }}
                    placeholder="Sets"
                    value={ex.sets}
                    onChange={(e) => updateExerciseRow(i, 'sets', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: 80 }}
                    placeholder="Reps"
                    value={ex.reps}
                    onChange={(e) => updateExerciseRow(i, 'reps', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: 90 }}
                    placeholder="Weight"
                    value={ex.weight}
                    onChange={(e) => updateExerciseRow(i, 'weight', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeExerciseRow(i)}
                    disabled={exercises.length <= 1}
                  >
                    <Trash2 size={13} color="var(--status-danger)" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Saving Plan...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

