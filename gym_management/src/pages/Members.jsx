import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, Trash2, Filter } from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/DataTable';
import { SearchBar } from '../components/SearchBar';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

export function Members() {
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [trainers, setTrainers] = useState([]);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [currentMember, setCurrentMember] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
    gender: 'male',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    trainer_id: '',
    status: 'active',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Archive dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [memberToArchive, setMemberToArchive] = useState(null);

  const { isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();

  const loadMembers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/members', {
        page,
        limit: 10,
        search,
        status: statusFilter,
      });
      setMembers(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers(1);
  }, [search, statusFilter]);

  useEffect(() => {
    async function fetchTrainers() {
      try {
        const list = await api.get('/trainers', { status: 'active' });
        setTrainers(list);
      } catch (e) {
        console.warn('Could not load trainers for dropdown:', e);
      }
    }
    fetchTrainers();
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      date_of_birth: '',
      gender: 'male',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      trainer_id: '',
      status: 'active',
      notes: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (member) => {
    setModalMode('edit');
    setCurrentMember(member);
    setFormData({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      phone: member.phone || '',
      address: member.address || '',
      date_of_birth: member.date_of_birth || '',
      gender: member.gender || 'male',
      emergency_contact_name: member.emergency_contact_name || '',
      emergency_contact_phone: member.emergency_contact_phone || '',
      trainer_id: member.trainer_id || '',
      status: member.status || 'active',
      notes: member.notes || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setFormSubmitting(true);

    try {
      const payload = {
        ...formData,
        trainer_id: formData.trainer_id ? Number(formData.trainer_id) : null,
      };

      if (modalMode === 'create') {
        await api.post('/members', payload);
      } else {
        await api.put(`/members/${currentMember.id}`, payload);
      }

      setIsModalOpen(false);
      loadMembers(pagination.page);
    } catch (err) {
      if (err.errors) {
        setFormErrors(err.errors);
      } else {
        setFormErrors({ general: err.message || 'Operation failed.' });
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!memberToArchive) return;
    try {
      await api.delete(`/members/${memberToArchive.id}`);
      setConfirmOpen(false);
      loadMembers(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to archive member');
    }
  };

  const columns = [
    {
      header: 'Member Code',
      accessor: 'member_code',
      render: (m) => <strong>{m.member_code}</strong>,
    },
    {
      header: 'Full Name',
      render: (m) => `${m.first_name} ${m.last_name}`,
    },
    {
      header: 'Contact Info',
      render: (m) => (
        <div>
          <div style={{ fontSize: '0.85rem' }}>{m.email}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.phone || 'No phone'}</div>
        </div>
      ),
    },
    {
      header: 'Current Plan',
      render: (m) => (
        <div>
          <span style={{ fontWeight: 500 }}>{m.current_plan_name || 'No Plan'}</span>
          {m.membership_end_date && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Expires: {m.membership_end_date}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Trainer',
      accessor: 'trainer_name',
      render: (m) => m.trainer_name || 'None',
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (m) => (
        <span
          className={`badge badge-${
            m.status === 'active' ? 'success' : m.status === 'inactive' ? 'warning' : 'neutral'
          }`}
        >
          {m.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (m) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            title="View Details"
            onClick={() => navigate(`/members/${m.id}`)}
          >
            <Eye size={14} />
          </button>
          {isStaff && (
            <button
              className="btn btn-secondary btn-sm"
              title="Edit Profile"
              onClick={() => openEditModal(m)}
            >
              <Edit size={14} />
            </button>
          )}
          {isStaff && (
            <button
              className="btn btn-secondary btn-sm"
              title="Archive Member"
              onClick={() => {
                setMemberToArchive(m);
                setConfirmOpen(true);
              }}
            >
              <Trash2 size={14} color="var(--status-danger)" />
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
          <h1 className="page-title">Member Management</h1>
          <p className="page-subtitle">Register, manage and track gym members and subscriptions</p>
        </div>
        {isStaff && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            <span>Register New Member</span>
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, email, or member code..."
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-input"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={members}
          loading={loading}
          pagination={pagination}
          onPageChange={loadMembers}
        />
      </div>

      {/* Member Create/Edit Modal (Requirement 5) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Register New Gym Member' : `Edit Member: ${currentMember?.member_code}`}
        maxWidth={640}
      >
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {formErrors.general && (
            <div style={{ padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: '0.85rem' }}>
              {formErrors.general}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
              {formErrors.first_name && <span className="field-error">{formErrors.first_name}</span>}
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
              {formErrors.last_name && <span className="field-error">{formErrors.last_name}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              {formErrors.email && <span className="field-error">{formErrors.email}</span>}
            </div>
            <div>
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+63 912 345 6789"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Gender</label>
              <select
                className="form-input"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Home Address</label>
            <input
              type="text"
              className="form-input"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Emergency Contact Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.emergency_contact_name}
                onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Emergency Contact Phone</label>
              <input
                type="text"
                className="form-input"
                value={formData.emergency_contact_phone}
                onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Assigned Personal Trainer</label>
            <select
              className="form-input"
              value={formData.trainer_id}
              onChange={(e) => setFormData({ ...formData, trainer_id: e.target.value })}
            >
              <option value="">-- No Assigned Trainer --</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.specialization || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Notes & Medical Considerations</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Allergies, injuries, or personal fitness goals..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
              {formSubmitting ? 'Saving...' : modalMode === 'create' ? 'Register Member' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Safe Archive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleArchiveConfirm}
        title="Archive Member"
        message={`Are you sure you want to archive member ${memberToArchive?.first_name} ${memberToArchive?.last_name} (${memberToArchive?.member_code})? All payment and attendance history will remain safely preserved.`}
        confirmText="Archive Member"
      />
    </div>
  );
}

