import React, { useEffect, useState } from 'react';
import { Wrench, CheckCircle2, Clock, AlertTriangle, Filter } from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';

export function Maintenance() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Complete maintenance modal
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [completeForm, setCompleteForm] = useState({
    completed_date: '',
    cost: '',
    condition_after: 'good',
    technician: '',
    notes: '',
  });
  const [completing, setCompleting] = useState(false);

  const loadData = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/maintenance', {
        page,
        limit: 10,
        status: statusFilter,
        overdue_only: overdueOnly ? 'true' : undefined,
      });
      setRecords(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load maintenance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [statusFilter, overdueOnly]);

  const openCompleteModal = (r) => {
    setSelectedRecord(r);
    setCompleteForm({
      completed_date: new Date().toISOString().slice(0, 10),
      cost: r.cost || '',
      condition_after: 'good',
      technician: r.technician || '',
      notes: '',
    });
    setCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setCompleting(true);

    try {
      await api.patch(`/maintenance/${selectedRecord.id}/complete`, {
        completed_date: completeForm.completed_date,
        cost: completeForm.cost ? Number(completeForm.cost) : 0,
        condition_after: completeForm.condition_after,
        technician: completeForm.technician || undefined,
        notes: completeForm.notes || undefined,
      });
      setCompleteModalOpen(false);
      loadData(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to complete maintenance');
    } finally {
      setCompleting(false);
    }
  };

  const columns = [
    {
      header: 'ID',
      accessor: 'id',
      render: (r) => <strong>#{r.id}</strong>,
    },
    {
      header: 'Equipment',
      render: (r) => (
        <div>
          <strong>{r.equipment_name}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.equipment_code} ({r.location})</div>
        </div>
      ),
    },
    {
      header: 'Issue Description',
      accessor: 'issue_description',
      render: (r) => (
        <div style={{ maxWidth: 220, fontSize: '0.85rem' }}>{r.issue_description}</div>
      ),
    },
    {
      header: 'Priority',
      accessor: 'priority',
      render: (r) => (
        <span
          className={`badge badge-${
            r.priority === 'critical' || r.priority === 'high' ? 'danger' : r.priority === 'medium' ? 'warning' : 'neutral'
          }`}
        >
          {r.priority}
        </span>
      ),
    },
    {
      header: 'Dates',
      render: (r) => (
        <div style={{ fontSize: '0.8rem' }}>
          <div>Reported: {r.reported_date}</div>
          {r.scheduled_date && <div>Scheduled: {r.scheduled_date}</div>}
          {r.completed_date && <div style={{ color: 'var(--status-success)' }}>Done: {r.completed_date}</div>}
        </div>
      ),
    },
    {
      header: 'Cost (PHP)',
      accessor: 'cost',
      render: (r) => (r.cost > 0 ? `PHP ${Number(r.cost).toLocaleString()}` : '—'),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => (
        <span
          className={`badge badge-${
            r.status === 'completed'
              ? 'success'
              : r.status === 'scheduled' || r.status === 'in_progress'
              ? 'warning'
              : 'danger'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {r.status !== 'completed' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => openCompleteModal(r)}
            >
              <CheckCircle2 size={14} color="var(--status-success)" />
              <span>Mark Done</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment Maintenance & Repairs</h1>
          <p className="page-subtitle">Track work orders, technicians, repair costs, and restored machine status</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            Show Overdue Maintenance Only
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          pagination={pagination}
          onPageChange={loadData}
        />
      </div>

      {/* Complete Maintenance Modal */}
      <Modal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title={selectedRecord ? `Resolve Maintenance: ${selectedRecord.equipment_name}` : ''}
      >
        <form onSubmit={handleCompleteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Completing this record will restore machine availability to <strong>"available"</strong> in inventory and update its condition.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Completion Date *</label>
              <input
                type="date"
                className="form-input"
                value={completeForm.completed_date}
                onChange={(e) => setCompleteForm({ ...completeForm, completed_date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Final Restored Condition</label>
              <select
                className="form-input"
                value={completeForm.condition_after}
                onChange={(e) => setCompleteForm({ ...completeForm, condition_after: e.target.value })}
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Total Repair / Service Cost (PHP)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={completeForm.cost}
                onChange={(e) => setCompleteForm({ ...completeForm, cost: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Technician / Company</label>
              <input
                type="text"
                className="form-input"
                value={completeForm.technician}
                onChange={(e) => setCompleteForm({ ...completeForm, technician: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Technician Notes / Work Performed</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Parts replaced, alignment made, tests passed..."
              value={completeForm.notes}
              onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCompleteModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={completing}>
              {completing ? 'Completing...' : 'Save & Restore Machine'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

