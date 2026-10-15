import React, { useEffect, useState } from 'react';
import { Plus, Package, Wrench, Edit, Trash2, Filter } from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/DataTable';
import { SearchBar } from '../components/SearchBar';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

export function Equipment() {
  const [equipmentList, setEquipmentList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [needsMaintOnly, setNeedsMaintOnly] = useState(false);

  // Equipment modal
  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState(null);
  const [equipForm, setEquipForm] = useState({
    name: '',
    category: 'cardio',
    brand: '',
    model: '',
    quantity: 1,
    purchase_date: '',
    purchase_price: '',
    location: '',
    condition: 'good',
    status: 'available',
    maintenance_interval_days: 90,
    notes: '',
  });

  // Report issue modal
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedEquip, setSelectedEquip] = useState(null);
  const [issueForm, setIssueForm] = useState({
    issue_description: '',
    maintenance_type: 'repair',
    priority: 'medium',
    scheduled_date: '',
    technician: '',
    cost: '',
  });

  const { isStaff, isAdmin } = useAuth();

  const loadData = async (page = 1) => {
    setLoading(true);
    try {
      const [listRes, statRes] = await Promise.all([
        api.get('/equipment', {
          page,
          limit: 10,
          search,
          category: categoryFilter,
          condition: conditionFilter,
          needs_maintenance: needsMaintOnly ? 'true' : undefined,
        }),
        api.get('/equipment/stats'),
      ]);
      setEquipmentList(listRes.data);
      setPagination(listRes.pagination);
      setStats(statRes);
    } catch (err) {
      console.error('Failed to load equipment:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [search, categoryFilter, conditionFilter, needsMaintOnly]);

  const openCreateEquip = () => {
    setEditingEquip(null);
    setEquipForm({
      name: '',
      category: 'cardio',
      brand: '',
      model: '',
      quantity: 1,
      purchase_date: '',
      purchase_price: '',
      location: 'Main Gym Floor',
      condition: 'good',
      status: 'available',
      maintenance_interval_days: 90,
      notes: '',
    });
    setEquipModalOpen(true);
  };

  const openEditEquip = (eq) => {
    setEditingEquip(eq);
    setEquipForm({
      name: eq.name,
      category: eq.category,
      brand: eq.brand || '',
      model: eq.model || '',
      quantity: eq.quantity,
      purchase_date: eq.purchase_date || '',
      purchase_price: eq.purchase_price || '',
      location: eq.location || '',
      condition: eq.condition,
      status: eq.status,
      maintenance_interval_days: eq.maintenance_interval_days || 90,
      notes: eq.notes || '',
    });
    setEquipModalOpen(true);
  };

  const handleEquipSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...equipForm,
        quantity: Number(equipForm.quantity),
        purchase_price: equipForm.purchase_price ? Number(equipForm.purchase_price) : undefined,
        maintenance_interval_days: equipForm.maintenance_interval_days ? Number(equipForm.maintenance_interval_days) : undefined,
      };

      if (editingEquip) {
        await api.put(`/equipment/${editingEquip.id}`, payload);
      } else {
        await api.post('/equipment', payload);
      }
      setEquipModalOpen(false);
      loadData(pagination.page);
    } catch (err) {
      alert(err.message || 'Operation failed');
    }
  };

  const openReportIssue = (eq) => {
    setSelectedEquip(eq);
    setIssueForm({
      issue_description: '',
      maintenance_type: 'repair',
      priority: 'high',
      scheduled_date: '',
      technician: '',
      cost: '',
    });
    setIssueModalOpen(true);
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEquip) return;
    try {
      await api.post('/maintenance', {
        equipment_id: selectedEquip.id,
        issue_description: issueForm.issue_description,
        maintenance_type: issueForm.maintenance_type,
        priority: issueForm.priority,
        scheduled_date: issueForm.scheduled_date || undefined,
        technician: issueForm.technician || undefined,
        cost: issueForm.cost ? Number(issueForm.cost) : 0,
        update_equipment_status: true,
      });
      setIssueModalOpen(false);
      loadData(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to report issue');
    }
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'equipment_code',
      render: (eq) => <strong>{eq.equipment_code}</strong>,
    },
    {
      header: 'Equipment Name',
      render: (eq) => (
        <div>
          <strong>{eq.name}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {eq.brand} {eq.model && `• ${eq.model}`}
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (eq) => <span className="badge badge-info">{eq.category?.replace('_', ' ')}</span>,
    },
    {
      header: 'Quantity',
      render: (eq) => (
        <span>
          {eq.quantity} units {eq.out_of_service_qty > 0 && <span style={{ color: 'var(--status-danger)', fontSize: '0.78rem' }}>({eq.out_of_service_qty} down)</span>}
        </span>
      ),
    },
    {
      header: 'Condition',
      accessor: 'condition',
      render: (eq) => (
        <span
          className={`badge badge-${
            eq.condition === 'excellent' || eq.condition === 'good' ? 'success' : eq.condition === 'fair' ? 'warning' : 'danger'
          }`}
        >
          {eq.condition}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (eq) => (
        <span
          className={`badge badge-${
            eq.status === 'available' ? 'success' : eq.status === 'under_maintenance' ? 'warning' : 'danger'
          }`}
        >
          {eq.status?.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Location',
      accessor: 'location',
      render: (eq) => eq.location || 'Floor',
    },
    {
      header: 'Actions',
      align: 'right',
      render: (eq) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {isStaff && (
            <button
              className="btn btn-secondary btn-sm"
              title="Report Issue / Maintenance"
              onClick={() => openReportIssue(eq)}
            >
              <Wrench size={14} color="var(--color-orange)" />
            </button>
          )}
          {isStaff && (
            <button
              className="btn btn-secondary btn-sm"
              title="Edit Details"
              onClick={() => openEditEquip(eq)}
            >
              <Edit size={14} />
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
          <h1 className="page-title">Gym Equipment & Machines</h1>
          <p className="page-subtitle">Inventory management, condition tracking, and maintenance schedules</p>
        </div>
        {isStaff && (
          <button className="btn btn-primary" onClick={openCreateEquip}>
            <Plus size={16} />
            <span>Add Equipment</span>
          </button>
        )}
      </div>

      {/* Summary KPI Cards (Requirement 11) */}
      <div className="grid grid-cols-4" style={{ marginBottom: 20 }}>
        <StatCard
          title="Total Machine Units"
          value={stats?.summary?.total_units || 0}
          icon={Package}
          color="#3b82f6"
          subtext="Active in gym floor"
        />
        <StatCard
          title="Total Inventory Value"
          value={`PHP ${Number(stats?.summary?.total_value || 0).toLocaleString()}`}
          icon={Package}
          color="#10b981"
          subtext="Calculated from purchases"
        />
        <StatCard
          title="Distinct Models"
          value={stats?.summary?.total_models || 0}
          icon={Package}
          color="#8b5cf6"
          subtext="Catalog items"
        />
        <StatCard
          title="Needs Maintenance"
          value={stats?.summary?.needs_maintenance_count || 0}
          icon={Wrench}
          color="#f59e0b"
          subtext="Repair or overdue inspection"
        />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search code, equipment name, brand, location..."
            />
          </div>
          <div>
            <select
              className="form-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="cardio">Cardio</option>
              <option value="strength_machine">Strength Machines</option>
              <option value="free_weights">Free Weights</option>
              <option value="functional">Functional</option>
              <option value="accessories">Accessories</option>
            </select>
          </div>
          <div>
            <select
              className="form-input"
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
            >
              <option value="">All Conditions</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={needsMaintOnly}
              onChange={(e) => setNeedsMaintOnly(e.target.checked)}
            />
            Needs Maintenance Only
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={equipmentList}
          loading={loading}
          pagination={pagination}
          onPageChange={loadData}
        />
      </div>

      {/* Equipment Create/Edit Modal */}
      <Modal
        isOpen={equipModalOpen}
        onClose={() => setEquipModalOpen(false)}
        title={editingEquip ? `Edit Equipment: ${editingEquip.equipment_code}` : 'Add New Gym Equipment'}
        maxWidth={640}
      >
        <form onSubmit={handleEquipSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Equipment Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Olympic Barbell & Bumper Plate Set"
                value={equipForm.name}
                onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Category *</label>
              <select
                className="form-input"
                value={equipForm.category}
                onChange={(e) => setEquipForm({ ...equipForm, category: e.target.value })}
                required
              >
                <option value="cardio">Cardio</option>
                <option value="strength_machine">Strength Machine</option>
                <option value="free_weights">Free Weights</option>
                <option value="functional">Functional</option>
                <option value="accessories">Accessories</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Brand</label>
              <input
                type="text"
                className="form-input"
                value={equipForm.brand}
                onChange={(e) => setEquipForm({ ...equipForm, brand: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Model</label>
              <input
                type="text"
                className="form-input"
                value={equipForm.model}
                onChange={(e) => setEquipForm({ ...equipForm, model: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Quantity *</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={equipForm.quantity}
                onChange={(e) => setEquipForm({ ...equipForm, quantity: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Purchase Date</label>
              <input
                type="date"
                className="form-input"
                value={equipForm.purchase_date}
                onChange={(e) => setEquipForm({ ...equipForm, purchase_date: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Total Purchase Price (PHP)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={equipForm.purchase_price}
                onChange={(e) => setEquipForm({ ...equipForm, purchase_price: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Location / Zone</label>
              <input
                type="text"
                className="form-input"
                placeholder="Cardio Area, Level 2..."
                value={equipForm.location}
                onChange={(e) => setEquipForm({ ...equipForm, location: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Condition</label>
              <select
                className="form-input"
                value={equipForm.condition}
                onChange={(e) => setEquipForm({ ...equipForm, condition: e.target.value })}
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={equipForm.status}
                onChange={(e) => setEquipForm({ ...equipForm, status: e.target.value })}
              >
                <option value="available">Available</option>
                <option value="in_use">In Use</option>
                <option value="damaged">Damaged</option>
                <option value="under_maintenance">Under Maintenance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Notes & Specifications</label>
            <textarea
              className="form-input"
              rows={2}
              value={equipForm.notes}
              onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setEquipModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingEquip ? 'Update Equipment' : 'Add Equipment'}</button>
          </div>
        </form>
      </Modal>

      {/* Report Maintenance Modal */}
      <Modal
        isOpen={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        title={selectedEquip ? `Report Issue: ${selectedEquip.name} (${selectedEquip.equipment_code})` : ''}
      >
        <form onSubmit={handleIssueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Issue Description *</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Describe malfunction, strange sound, torn upholstery, or error code..."
              value={issueForm.issue_description}
              onChange={(e) => setIssueForm({ ...issueForm, issue_description: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Maintenance Type *</label>
              <select
                className="form-input"
                value={issueForm.maintenance_type}
                onChange={(e) => setIssueForm({ ...issueForm, maintenance_type: e.target.value })}
              >
                <option value="repair">Repair</option>
                <option value="corrective">Corrective</option>
                <option value="preventive">Preventive</option>
                <option value="inspection">Inspection</option>
                <option value="replacement">Parts Replacement</option>
              </select>
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select
                className="form-input"
                value={issueForm.priority}
                onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical (Unsafe)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Scheduled Repair Date</label>
              <input
                type="date"
                className="form-input"
                value={issueForm.scheduled_date}
                onChange={(e) => setIssueForm({ ...issueForm, scheduled_date: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Assigned Technician</label>
              <input
                type="text"
                className="form-input"
                placeholder="In-house or external service"
                value={issueForm.technician}
                onChange={(e) => setIssueForm({ ...issueForm, technician: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIssueModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Maintenance Request</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

